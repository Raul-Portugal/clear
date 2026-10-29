import { z } from 'zod';
import type { Dump, Tag, Task } from '../domain/types';
import { db } from './db';

const BACKUP_VERSION = 1;

const backupSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  tasks: z.array(z.custom<Task>((v) => typeof v === 'object' && v !== null && typeof (v as Task).id === 'string' && typeof (v as Task).title === 'string')),
  dumps: z.array(z.custom<Dump>((v) => typeof v === 'object' && v !== null && typeof (v as Dump).id === 'string')).optional(),
  tags: z.array(z.custom<Tag>((v) => typeof v === 'object' && v !== null && typeof (v as Tag).id === 'string')),
});

export async function exportJson(): Promise<string> {
  const [tasks, tags, dumps] = await Promise.all([db.tasks.toArray(), db.tags.toArray(), db.dumps.toArray()]);
  return JSON.stringify({ version: BACKUP_VERSION, exportedAt: Date.now(), tasks, tags, dumps: dumps.map((d) => ({ ...d, audioIds: [] })) }, null, 2);
}

/** Merges a backup into the local database (existing ids are replaced when the backup is newer). */
export async function importJson(text: string): Promise<{ tasks: number; tags: number }> {
  const data = backupSchema.parse(JSON.parse(text));
  await db.transaction('rw', db.tasks, db.tags, db.dumps, async () => {
    for (const t of data.tasks) {
      const cur = await db.tasks.get(t.id);
      if (!cur || cur.updatedAt <= t.updatedAt) await db.tasks.put(t);
    }
    for (const g of data.tags) {
      const cur = await db.tags.get(g.id);
      if (!cur || (cur.updatedAt ?? 0) <= (g.updatedAt ?? 0)) await db.tags.put(g);
    }
    for (const d of data.dumps ?? []) {
      const cur = await db.dumps.get(d.id);
      if (!cur || cur.updatedAt <= d.updatedAt) await db.dumps.put({ ...d, audioIds: cur?.audioIds ?? [] });
    }
  });
  return { tasks: data.tasks.length, tags: data.tags.length };
}
