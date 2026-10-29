import { mergeRow } from '../domain/merge';
import type { Dump, Tag, Task } from '../domain/types';
import { db } from './db';

export interface RemoteStore {
  pullTasks(since: number): Promise<Task[]>;
  pushTasks(rows: Task[]): Promise<void>;
  pullTags(since: number): Promise<Tag[]>;
  pushTags(rows: Tag[]): Promise<void>;
  pullDumps(since: number): Promise<Dump[]>;
  pushDumps(rows: Dump[]): Promise<void>;
}

export interface SyncOptions {
  now?: () => number;
  /** localStorage key for the cursors; use one per signed-in user. */
  cursorKey?: string;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
}

type Collection = 'tasks' | 'tags' | 'dumps';
type Cursors = Record<Collection, number>;

const DEFAULT_CURSOR_KEY = 'clear-sync-cursor';
const MAX_BACKOFF_MS = 5 * 60 * 1000;

function readCursors(key: string): Cursors {
  const out: Cursors = { tasks: 0, tags: 0, dumps: 0 };
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (typeof raw === 'object' && raw !== null) {
      for (const c of ['tasks', 'tags', 'dumps'] as const) {
        const n = (raw as Record<string, unknown>)[c];
        if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[c] = n;
      }
    }
  } catch {
    // Missing or unreadable: start from scratch.
  }
  return out;
}

function writeCursors(key: string, value: Cursors): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the next sync just re-pulls.
  }
}

interface Row {
  id: string;
  updatedAt?: number;
}

interface Adapter<T extends Row> {
  pull(since: number): Promise<T[]>;
  push(rows: T[]): Promise<void>;
  get(id: string): Promise<T | undefined>;
  put(row: T): Promise<void>;
  changedSince(cursor: number): Promise<T[]>;
  /** What to store when adopting a remote row over the local one. */
  adopt(remote: T, local: T | undefined): T;
  /** What to send for a local row. */
  outgoing(row: T): T;
}

async function syncCollection<T extends Row>(a: Adapter<T>, cursor: number): Promise<{ cursor: number; pulled: number; pushed: number }> {
  let maxSeen = cursor;
  const remoteRows = await a.pull(cursor);
  const adopted = new Set<string>();
  for (const r of remoteRows) {
    maxSeen = Math.max(maxSeen, r.updatedAt ?? 0);
    const local = await a.get(r.id);
    if (mergeRow(local, r) === r) {
      const next = a.adopt(r, local);
      if (!local || JSON.stringify(local) !== JSON.stringify(next)) await a.put(next);
      adopted.add(r.id);
    }
  }
  const toPush = (await a.changedSince(cursor)).filter((t) => !adopted.has(t.id));
  if (toPush.length > 0) {
    await a.push(toPush.map((t) => a.outgoing(t)));
    for (const t of toPush) maxSeen = Math.max(maxSeen, t.updatedAt ?? 0);
  }
  return { cursor: maxSeen, pulled: remoteRows.length, pushed: toPush.length };
}

export function createSyncEngine(remote: RemoteStore, opts: SyncOptions = {}) {
  // Reserved for time-based policies; state is derived from updatedAt.
  const now = opts.now ?? Date.now;
  void now;
  const cursorKey = opts.cursorKey ?? DEFAULT_CURSOR_KEY;
  let inFlight: Promise<SyncResult> | null = null;

  const tasks: Adapter<Task> = {
    pull: (s) => remote.pullTasks(s),
    push: (r) => remote.pushTasks(r),
    get: (id) => db.tasks.get(id),
    put: async (r) => void (await db.tasks.put(r)),
    changedSince: (c) => db.tasks.where('updatedAt').above(c).toArray(),
    adopt: (r) => r,
    outgoing: (r) => r,
  };
  const tags: Adapter<Tag> = {
    pull: (s) => remote.pullTags(s),
    push: (r) => remote.pushTags(r),
    get: (id) => db.tags.get(id),
    put: async (r) => void (await db.tags.put(r)),
    // Rows written before sync have no updatedAt (not indexed): include them on a full sync.
    changedSince: async (c) =>
      c === 0 ? db.tags.toArray() : db.tags.where('updatedAt').above(c).toArray(),
    adopt: (r) => r,
    outgoing: (r) => r,
  };
  const dumps: Adapter<Dump> = {
    pull: (s) => remote.pullDumps(s),
    push: (r) => remote.pushDumps(r),
    get: (id) => db.dumps.get(id),
    put: async (r) => void (await db.dumps.put(r)),
    changedSince: (c) => db.dumps.where('updatedAt').above(c).toArray(),
    // Audio blobs are device-local: never let a remote copy erase local recordings.
    adopt: (r, local) => ({ ...r, audioIds: local?.audioIds ?? [] }),
    outgoing: (r) => ({ ...r, audioIds: [] }),
  };

  async function run(): Promise<SyncResult> {
    const cursors = readCursors(cursorKey);
    const next = { ...cursors };
    let pulled = 0;
    let pushed = 0;
    const steps: [Collection, () => Promise<{ cursor: number; pulled: number; pushed: number }>][] = [
      ['tasks', () => syncCollection(tasks, cursors.tasks)],
      ['tags', () => syncCollection(tags, cursors.tags)],
      ['dumps', () => syncCollection(dumps, cursors.dumps)],
    ];
    try {
      for (const [name, step] of steps) {
        const r = await step();
        next[name] = r.cursor;
        pulled += r.pulled;
        pushed += r.pushed;
      }
    } finally {
      // Keep the cursors of collections that completed even if a later one failed.
      writeCursors(cursorKey, next);
    }
    return { pulled, pushed };
  }

  function syncOnce(): Promise<SyncResult> {
    if (!inFlight) {
      inFlight = run().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  function start(intervalMs = 30_000): () => void {
    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (delay: number) => {
      if (stopped) return;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(tick, delay);
    };

    const tick = () => {
      timer = undefined;
      syncOnce().then(
        () => {
          failures = 0;
          schedule(intervalMs);
        },
        () => {
          failures += 1;
          schedule(Math.min(intervalMs * 2 ** failures, MAX_BACKOFF_MS));
        },
      );
    };

    const onOnline = () => {
      failures = 0;
      schedule(0);
    };

    if (typeof window !== 'undefined') window.addEventListener('online', onOnline);
    schedule(0);

    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
    };
  }

  return { syncOnce, start };
}
