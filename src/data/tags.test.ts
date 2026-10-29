import { db } from './db';
import { createTask } from './repo';
import { deleteTag, ensureTag, ensureTags, renameTag } from './tags';
import { clearUndo, undoLast } from './undo';

beforeEach(async () => {
  await db.tasks.clear();
  await db.tags.clear();
  clearUndo();
});

describe('tags', () => {
  it('ensureTag is idempotent and case-insensitive', async () => {
    const a = await ensureTag('#Work');
    const b = await ensureTag('work');
    expect(a.id).toBe(b.id);
    expect(a.name).toBe('work');
    expect(await db.tags.count()).toBe(1);
  });

  it('assigns rotating colours', async () => {
    const ids = await ensureTags(['a', 'b']);
    const [a, b] = await Promise.all(ids.map((i) => db.tags.get(i)));
    expect(a?.color).not.toBe(b?.color);
  });

  it('renames', async () => {
    const t = await ensureTag('x');
    await renameTag(t.id, 'Y');
    expect((await db.tags.get(t.id))?.name).toBe('y');
  });

  it('deleting a tag strips it from tasks and undo restores', async () => {
    const t = await ensureTag('x');
    const task = await createTask({ title: 'a', tagIds: [t.id] });
    clearUndo();
    await deleteTag(t.id);
    expect((await db.tasks.get(task.id))?.tagIds).toEqual([]);
    await undoLast();
    expect((await db.tasks.get(task.id))?.tagIds).toEqual([t.id]);
    expect((await db.tags.get(t.id))?.deletedAt).toBeUndefined();
  });

  it('delete is a soft delete and ensureTag then creates a fresh tag', async () => {
    const t = await ensureTag('x');
    await deleteTag(t.id);
    const row = await db.tags.get(t.id);
    expect(row?.deletedAt).toBeDefined();
    expect(row?.updatedAt).toBe(row?.deletedAt);
    const fresh = await ensureTag('x');
    expect(fresh.id).not.toBe(t.id);
  });

  it('stamps updatedAt on create and rename', async () => {
    const t = await ensureTag('x');
    expect(t.updatedAt).toBeGreaterThan(0);
    await renameTag(t.id, 'z');
    expect((await db.tags.get(t.id))?.updatedAt).toBeGreaterThanOrEqual(t.updatedAt ?? 0);
  });
});
