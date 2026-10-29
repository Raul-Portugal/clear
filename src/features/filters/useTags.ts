import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import type { Tag } from '../../domain/types';

export function useTags(): Tag[] {
  return useLiveQuery(() => db.tags.orderBy('order').filter((t) => !t.deletedAt).toArray(), []) ?? [];
}

export const tagColor = (c: string) => `var(${c})`;
