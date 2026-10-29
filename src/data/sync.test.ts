import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dump, Tag, Task } from '../domain/types';
import { db } from './db';
import { createSyncEngine, type RemoteStore } from './sync';

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'a',
  status: 'open',
  urgency: 0,
  tagIds: [],
  subtasks: [],
  order: 'a',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});
const tag = (over: Partial<Tag> = {}): Tag => ({ id: 'g1', name: 'work', color: '--tag-1', order: 'a', updatedAt: 1, ...over });
const dump = (over: Partial<Dump> = {}): Dump => ({ id: 'd1', text: 'hi', audioIds: [], createdAt: 1, updatedAt: 1, ...over });

class Table<T extends { id: string; updatedAt?: number }> {
  rows = new Map<string, T>();
  pull(since: number): T[] {
    return [...this.rows.values()].filter((r) => (r.updatedAt ?? 0) > since);
  }
  push(rows: T[]): void {
    for (const r of rows) {
      const cur = this.rows.get(r.id);
      if (!cur || (r.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) this.rows.set(r.id, r);
    }
  }
}

class FakeRemote implements RemoteStore {
  tasks = new Table<Task>();
  tags = new Table<Tag>();
  dumps = new Table<Dump>();
  fail = 0;
  async pullTasks(since: number) {
    if (this.fail > 0) {
      this.fail -= 1;
      throw new Error('offline');
    }
    return this.tasks.pull(since);
  }
  async pushTasks(rows: Task[]) {
    this.tasks.push(rows);
  }
  async pullTags(since: number) {
    return this.tags.pull(since);
  }
  async pushTags(rows: Tag[]) {
    this.tags.push(rows);
  }
  async pullDumps(since: number) {
    return this.dumps.pull(since);
  }
  async pushDumps(rows: Dump[]) {
    this.dumps.push(rows);
  }
}

// Both devices share one process, so a "device" is swapped in as the local Dexie + cursor.
interface Device {
  tasks: Task[];
  tags: Tag[];
  dumps: Dump[];
  cursor: string | null;
}
const newDevice = (): Device => ({ tasks: [], tags: [], dumps: [], cursor: null });
async function asDevice<T>(d: Device, fn: () => Promise<T>): Promise<T> {
  await Promise.all([db.tasks.clear(), db.tags.clear(), db.dumps.clear()]);
  await db.tasks.bulkPut(d.tasks);
  await db.tags.bulkPut(d.tags);
  await db.dumps.bulkPut(d.dumps);
  if (d.cursor === null) localStorage.removeItem('clear-sync-cursor');
  else localStorage.setItem('clear-sync-cursor', d.cursor);
  try {
    return await fn();
  } finally {
    d.tasks = await db.tasks.toArray();
    d.tags = await db.tags.toArray();
    d.dumps = await db.dumps.toArray();
    d.cursor = localStorage.getItem('clear-sync-cursor');
  }
}

describe('sync engine', () => {
  let remote: FakeRemote;
  let a: Device;
  let b: Device;
  const engine = () => createSyncEngine(remote);
  const sync = (d: Device) => asDevice(d, () => engine().syncOnce());

  beforeEach(async () => {
    remote = new FakeRemote();
    a = newDevice();
    b = newDevice();
    await Promise.all([db.tasks.clear(), db.tags.clear(), db.dumps.clear()]);
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('propagates offline edits between devices', async () => {
    a.tasks = [task({ id: 'x', title: 'from A', updatedAt: 10 })];
    b.tasks = [task({ id: 'y', title: 'from B', updatedAt: 11 })];
    expect(await sync(a)).toEqual({ pulled: 0, pushed: 1 });
    await sync(b);
    await sync(a);
    expect(a.tasks.map((t) => t.id).sort()).toEqual(['x', 'y']);
    expect(b.tasks.map((t) => t.id).sort()).toEqual(['x', 'y']);
  });

  it('resolves concurrent edits by last write wins', async () => {
    a.tasks = [task({ title: 'A', updatedAt: 20 })];
    b.tasks = [task({ title: 'B', updatedAt: 30 })];
    await sync(a);
    await sync(b);
    await sync(a);
    expect(a.tasks[0].title).toBe('B');
    expect(b.tasks[0].title).toBe('B');
    expect(remote.tasks.rows.get('t1')?.title).toBe('B');
  });

  it('propagates deletes as tombstones', async () => {
    a.tasks = [task({ updatedAt: 5 })];
    await sync(a);
    await sync(b);
    a.tasks = [task({ updatedAt: 9, deletedAt: 9 })];
    await sync(a);
    await sync(b);
    expect(b.tasks[0].deletedAt).toBe(9);
  });

  it('converges tasks, tags and dumps across two devices', async () => {
    a.tags = [tag({ updatedAt: 10 })];
    a.tasks = [task({ tagIds: ['g1'], updatedAt: 11 })];
    a.dumps = [dump({ text: 'from A', updatedAt: 12 })];
    b.dumps = [dump({ id: 'd2', text: 'from B', updatedAt: 13 })];
    await sync(a);
    await sync(b);
    await sync(a);
    expect(b.tags.map((t) => t.name)).toEqual(['work']);
    expect(b.tasks[0].tagIds).toEqual(['g1']);
    expect(a.dumps.map((d) => d.id).sort()).toEqual(['d1', 'd2']);
    expect(b.dumps.map((d) => d.id).sort()).toEqual(['d1', 'd2']);
  });

  it('pushes legacy tags that have no updatedAt', async () => {
    a.tags = [{ id: 'old', name: 'legacy', color: '--tag-2', order: 'a' }];
    await sync(a);
    expect(remote.tags.rows.has('old')).toBe(true);
  });

  it('propagates a tag soft delete', async () => {
    a.tags = [tag({ updatedAt: 5 })];
    await sync(a);
    await sync(b);
    a.tags = [tag({ updatedAt: 9, deletedAt: 9 })];
    await sync(a);
    await sync(b);
    expect(b.tags[0].deletedAt).toBe(9);
  });

  it('strips audioIds when pushing a dump', async () => {
    a.dumps = [dump({ audioIds: ['au1'], updatedAt: 4 })];
    await sync(a);
    expect(remote.dumps.rows.get('d1')?.audioIds).toEqual([]);
    expect(a.dumps[0].audioIds).toEqual(['au1']);
  });

  it('keeps local audioIds when adopting a remote dump', async () => {
    a.dumps = [dump({ audioIds: ['au1'], updatedAt: 4 })];
    await sync(a);
    remote.dumps.rows.set('d1', dump({ text: 'edited elsewhere', updatedAt: 8 }));
    await sync(a);
    expect(a.dumps[0].text).toBe('edited elsewhere');
    expect(a.dumps[0].audioIds).toEqual(['au1']);
    await sync(b);
    expect(b.dumps[0].audioIds).toEqual([]);
  });

  it('keeps one cursor per collection', async () => {
    a.tasks = [task({ updatedAt: 50 })];
    a.tags = [tag({ updatedAt: 7 })];
    a.dumps = [dump({ updatedAt: 20 })];
    await sync(a);
    expect(JSON.parse(a.cursor ?? '{}')).toEqual({ tasks: 50, tags: 7, dumps: 20 });
    // A tag older than the task cursor must still be pulled by another device.
    remote.tags.rows.set('g2', tag({ id: 'g2', name: 'late', updatedAt: 9 }));
    b.cursor = JSON.stringify({ tasks: 50, tags: 8, dumps: 20 });
    await sync(b);
    expect(b.tags.map((t) => t.id)).toEqual(['g2']);
  });

  it('uses a custom cursor key', async () => {
    a.tasks = [task({ updatedAt: 5 })];
    await asDevice(a, async () => {
      await createSyncEngine(remote, { cursorKey: 'k2' }).syncOnce();
      expect(JSON.parse(localStorage.getItem('k2') ?? '{}').tasks).toBe(5);
    });
  });

  it('is idempotent on a second sync', async () => {
    a.tasks = [task({ updatedAt: 5 })];
    a.tags = [tag({ updatedAt: 5 })];
    a.dumps = [dump({ updatedAt: 5 })];
    await sync(a);
    expect(await sync(a)).toEqual({ pulled: 0, pushed: 0 });
    await sync(b);
    expect(await sync(b)).toEqual({ pulled: 0, pushed: 0 });
  });

  it('retries with exponential backoff after failure', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const spy = vi.spyOn(remote, 'pullTasks');
    remote.fail = 2;
    const stop = engine().start(1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999); // backoff 2000
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000); // backoff 4000
    expect(spy).toHaveBeenCalledTimes(3);
    // The successful sync touches three Dexie tables in real time; let it finish and reschedule.
    for (let i = 0; i < 50; i++) await new Promise<void>((r) => setImmediate(r));
    await vi.advanceTimersByTimeAsync(1000); // success -> base interval
    expect(spy).toHaveBeenCalledTimes(4);
    stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(spy).toHaveBeenCalledTimes(4);
  });
});
