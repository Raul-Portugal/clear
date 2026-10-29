import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import type { Dump } from '../../domain/types';

/** Saved dumps still waiting to be organized, newest first. */
export function useDumps(): Dump[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.dumps.orderBy('createdAt').reverse().toArray();
    return all.filter((d) => !d.deletedAt && !d.organizedAt);
  }, []);
}

export function useDump(id: string | null): Dump | undefined {
  return useLiveQuery(() => (id ? db.dumps.get(id) : undefined), [id]);
}
