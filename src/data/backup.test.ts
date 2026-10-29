import { db } from './db';
import { createTask } from './repo';
import { ensureTag } from './tags';
import { exportJson, importJson } from './backup';

beforeEach(async () => {
  await db.tasks.clear();
  await db.tags.clear();
});

describe('backup', () => {
  it('round-trips through export and import', async () => {
    const tag = await ensureTag('work');
    await createTask({ title: 'a', tagIds: [tag.id] });
    const json = await exportJson();
    await db.tasks.clear();
    await db.tags.clear();
    expect(await importJson(json)).toEqual({ tasks: 1, tags: 1 });
    expect((await db.tasks.toArray())[0].title).toBe('a');
  });

  it('rejects malformed files', async () => {
    await expect(importJson('{"version":2}')).rejects.toThrow();
    await expect(importJson('nope')).rejects.toThrow();
  });
});
