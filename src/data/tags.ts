import { generateKeyBetween } from 'fractional-indexing';
import { v7 as uuid } from 'uuid';
import type { Tag } from '../domain/types';
import { db } from './db';
import { pushUndo } from './undo';

export const TAG_COLORS = ['--tag-1', '--tag-2', '--tag-3', '--tag-4', '--tag-5', '--tag-6', '--tag-7', '--tag-8'];

/** Finds a live tag by name (case-insensitive) or creates it with the next auto colour. */
export async function ensureTag(name: string): Promise<Tag> {
  const clean = name.trim().replace(/^#/, '').toLowerCase();
  const all = (await db.tags.orderBy('order').toArray()).filter((t) => !t.deletedAt);
  const found = all.find((t) => t.name === clean);
  if (found) return found;
  const tag: Tag = {
    id: uuid(),
    name: clean,
    color: TAG_COLORS[all.length % TAG_COLORS.length],
    order: generateKeyBetween(all.at(-1)?.order ?? null, null),
    updatedAt: Date.now(),
  };
  await db.tags.add(tag);
  return tag;
}

export async function ensureTags(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const n of names) ids.push((await ensureTag(n)).id);
  return ids;
}

export async function renameTag(id: string, name: string) {
  const before = await db.tags.get(id);
  if (!before) return;
  await db.tags.update(id, { name: name.trim().replace(/^#/, '').toLowerCase(), updatedAt: Date.now() });
  pushUndo({ label: 'Tag renamed', undo: async () => void (await db.tags.put({ ...before, updatedAt: Date.now() })) });
}

export async function recolorTag(id: string, color: string) {
  const before = await db.tags.get(id);
  if (!before) return;
  await db.tags.update(id, { color, updatedAt: Date.now() });
  pushUndo({ label: 'Tag recoloured', undo: async () => void (await db.tags.put({ ...before, updatedAt: Date.now() })) });
}

/** Soft-deletes a tag and strips it from every task (restorable via undo). */
export async function deleteTag(id: string) {
  const tag = await db.tags.get(id);
  if (!tag || tag.deletedAt) return;
  const affected = (await db.tasks.toArray()).filter((t) => t.tagIds.includes(id));
  await db.transaction('rw', db.tags, db.tasks, async () => {
    const now = Date.now();
    await db.tags.update(id, { deletedAt: now, updatedAt: now });
    for (const t of affected) {
      await db.tasks.update(t.id, { tagIds: t.tagIds.filter((x) => x !== id), updatedAt: now });
    }
  });
  pushUndo({
    label: 'Tag deleted',
    undo: async () => {
      const now = Date.now();
      await db.tags.update(id, { deletedAt: undefined, updatedAt: now });
      for (const t of affected) await db.tasks.update(t.id, { tagIds: t.tagIds, updatedAt: now });
    },
  });
}
