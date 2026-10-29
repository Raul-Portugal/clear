import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import type { Task } from '../../domain/types';

/** All non-deleted tasks, in manual order. `undefined` while loading. */
export function useTasks(): Task[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.tasks.orderBy('order').toArray();
    return all.filter((t) => !t.deletedAt);
  }, []);
}
