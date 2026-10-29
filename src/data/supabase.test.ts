import { describe, expect, it } from 'vitest';
import { createSupabaseRemote, type SupabaseLike } from './supabase';
import type { Task } from '../domain/types';

interface StoredRow {
  id: string;
  data: { id: string; updatedAt: number };
  updated_at: number;
}

function fakeClient(rows: StoredRow[], failWith?: string) {
  const upserts: { table: string; batch: unknown[]; opts: unknown }[] = [];
  const client = {
    from(table: string) {
      return {
        select() {
          let since = 0;
          const q = {
            gt(_col: string, v: number) {
              since = v;
              return q;
            },
            order() {
              return q;
            },
            range(a: number, b: number) {
              if (failWith) return Promise.resolve({ data: null, error: new Error(failWith) });
              const sorted = rows.filter((r) => r.updated_at > since).sort((x, y) => x.updated_at - y.updated_at);
              return Promise.resolve({ data: sorted.slice(a, b + 1).map((r) => ({ data: r.data })), error: null });
            },
          };
          return q;
        },
        upsert(batch: unknown[], opts: unknown) {
          upserts.push({ table, batch, opts });
          return Promise.resolve({ error: failWith ? new Error(failWith) : null });
        },
      };
    },
  };
  return { client: client as unknown as SupabaseLike, upserts };
}

const task = (n: number) => ({ id: `t${n}`, updatedAt: n }) as unknown as Task;

describe('createSupabaseRemote', () => {
  it('paginates pulls and applies the since filter', async () => {
    const rows: StoredRow[] = Array.from({ length: 2500 }, (_, i) => ({
      id: `t${i + 1}`,
      data: { id: `t${i + 1}`, updatedAt: i + 1 },
      updated_at: i + 1,
    }));
    const remote = createSupabaseRemote(fakeClient(rows).client);
    expect(await remote.pullTasks(0)).toHaveLength(2500);
    const some = await remote.pullTasks(2000);
    expect(some).toHaveLength(500);
    expect(some[0]).toMatchObject({ id: 't2001' });
  });

  it('upserts in batches of 200 with the row shape', async () => {
    const { client, upserts } = fakeClient([]);
    await createSupabaseRemote(client).pushTasks(Array.from({ length: 450 }, (_, i) => task(i + 1)));
    expect(upserts.map((u) => u.batch.length)).toEqual([200, 200, 50]);
    expect(upserts[0]).toMatchObject({ table: 'clear_tasks', opts: { onConflict: 'user_id,id' } });
    expect(upserts[0].batch[0]).toEqual({ id: 't1', data: task(1), updated_at: 1 });
  });

  it('uses the right table and defaults updated_at to 0', async () => {
    const { client, upserts } = fakeClient([]);
    await createSupabaseRemote(client).pushTags([{ id: 'a', name: 'x', color: 'c', order: 'a' }]);
    expect(upserts[0].table).toBe('clear_tags');
    expect(upserts[0].batch[0]).toMatchObject({ id: 'a', updated_at: 0 });
  });

  it('throws on supabase errors', async () => {
    const remote = createSupabaseRemote(fakeClient([], 'boom').client);
    await expect(remote.pullTasks(0)).rejects.toThrow('boom');
    await expect(remote.pushTasks([task(1)])).rejects.toThrow('boom');
  });
});
