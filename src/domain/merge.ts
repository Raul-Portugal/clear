import type { Dump, Tag, Task } from './types';

interface Versioned {
  updatedAt?: number;
}

/** Last-write-wins by updatedAt (missing = 0). A tie goes to remote so every device converges. */
export function mergeRow<T extends Versioned>(local: T | undefined, remote: T | undefined): T | undefined {
  if (!local) return remote;
  if (!remote) return local;
  return (remote.updatedAt ?? 0) >= (local.updatedAt ?? 0) ? remote : local;
}

/** Tombstones (deletedAt) are ordinary rows and win or lose by updatedAt. */
export function mergeTask(local: Task | undefined, remote: Task | undefined): Task | undefined {
  return mergeRow(local, remote);
}

export function mergeTag(local: Tag | undefined, remote: Tag | undefined): Tag | undefined {
  return mergeRow(local, remote);
}

export function mergeDump(local: Dump | undefined, remote: Dump | undefined): Dump | undefined {
  return mergeRow(local, remote);
}
