import Dexie, { type EntityTable } from 'dexie';
import type { Draft, Dump, Tag, Task } from '../domain/types';

export interface AudioNote {
  id: string;
  blob: Blob;
  createdAt: number;
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
