import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

describe('db v5 upgrade', () => {
  it('queues existing recordings for upload and bumps dumps that hold them', async () => {
    await Dexie.delete('clear');
    const old = new Dexie('clear');
    old.version(4).stores({
      tasks: 'id, status, order, updatedAt, deletedAt',
      tags: 'id, order, updatedAt',
      drafts: 'id',
      audio: 'id',
      dumps: 'id, createdAt, deletedAt, organizedAt, updatedAt',
    });
    await old.table('audio').add({ id: 'au1', blob: new Blob(['x']), createdAt: 1 });
    await old.table('dumps').bulkAdd([
      { id: 'd1', text: '', audioIds: ['au1'], createdAt: 1, updatedAt: 1 },
      { id: 'd2', text: 'plain', audioIds: [], createdAt: 1, updatedAt: 1 },
    ]);
    old.close();

    const { db } = await import('./db');
    await db.open();
    expect(await db.audio.where('pendingUpload').equals(1).primaryKeys()).toEqual(['au1']);
    expect((await db.dumps.get('d1'))?.updatedAt).toBeGreaterThan(1);
    expect((await db.dumps.get('d2'))?.updatedAt).toBe(1);
    db.close();
  });
});
