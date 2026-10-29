import { planReorder } from '../domain/reorderList';
import type { Task } from '../domain/types';
import { db } from './db';
import { setOrders } from './repo';

/** Moves a task one step up/down within the currently visible ids. Returns true when it moved. */
export async function moveTask(id: string, visibleIds: string[], dir: -1 | 1): Promise<boolean> {
  const i = visibleIds.indexOf(id);
  const seq = (await db.tasks.bulkGet(visibleIds)).filter((t): t is Task => !!t);
  const changes = planReorder(seq, i, i + dir);
  await setOrders(changes);
  return changes.length > 0;
}
