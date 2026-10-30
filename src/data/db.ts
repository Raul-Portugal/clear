import Dexie, { type EntityTable } from 'dexie';
import type { Draft, Dump, Tag, Task } from '../domain/types';

export interface AudioNote {
  id: string;
  /** Missing on a tombstone (pendingDelete). */
  blob?: Blob;
  createdAt: number;
  /** 1 until uploaded by sync. Absent (not 0) so the index only holds pending rows. */
  pendingUpload?: 1;
  /** 1 when removed locally but not yet removed remotely. */
  pendingDelete?: 1;
}

export const db = new Dexie('clear') as Dexie & {
  tasks: EntityTable<Task, 'id'>;
  tags: EntityTable<Tag, 'id'>;
  drafts: EntityTable<Draft, 'id'>;
  audio: EntityTable<AudioNote, 'id'>;
  dumps: EntityTable<Dump, 'id'>;
};

db.version(1).stores({
  tasks: 'id, status, order, updatedAt, deletedAt',
  tags: 'id, order',
  drafts: 'id',
});
db.version(2).stores({ audio: 'id' });
db.version(3).stores({ dumps: 'id, createdAt, deletedAt, organizedAt' });
db.version(4).stores({
  dumps: 'id, createdAt, deletedAt, organizedAt, updatedAt',
  tags: 'id, order, updatedAt',
});
// Audio sync: existing recordings are queued for upload, and dumps holding them are bumped so their clip lists push.
db.version(5)
  .stores({ audio: 'id, pendingUpload, pendingDelete' })
  .upgrade(async (tx) => {
    await tx.table('audio').toCollection().modify((a: AudioNote) => {
      a.pendingUpload = 1;
    });
    const now = Date.now();
    await tx
      .table('dumps')
      .filter((d: Dump) => d.audioIds.length > 0)
      .modify((d: Dump) => {
        d.updatedAt = now;
      });
  });
