import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Dump, Tag, Task } from '../domain/types';
import type { AudioRemote } from './audio';
import type { RemoteStore } from './sync';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

/** False when the env vars are missing: the app then stays fully local. */
export const syncConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!syncConfigured) return null;
  client ??= createClient(url, key, {
    auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
  });
  return client;
}

const PAGE = 1000;
const BATCH = 200;

type Entity = 'tasks' | 'tags' | 'dumps';

/** Remote table name per entity. Single source of truth for the adapter and realtime. */
export const TABLES: Record<Entity, string> = { tasks: 'clear_tasks', tags: 'clear_tags', dumps: 'clear_dumps' };
interface Row {
  id: string;
  updatedAt?: number;
}

/** Minimal slice of the supabase-js client used here (keeps the adapter testable with a fake). */
export type SupabaseLike = Pick<SupabaseClient, 'from'>;

export function createSupabaseRemote(c: SupabaseLike): RemoteStore {
  async function pull<T>(entity: Entity, since: number): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await c
        .from(TABLES[entity])
        .select('data')
        .gt('updated_at', since)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as { data: T }[];
      for (const r of rows) out.push(r.data);
      if (rows.length < PAGE) return out;
    }
  }

  async function push<T extends Row>(entity: Entity, rows: T[]): Promise<void> {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map((r) => ({ id: r.id, data: r, updated_at: r.updatedAt ?? 0 }));
      const { error } = await c.from(TABLES[entity]).upsert(batch, { onConflict: 'user_id,id' });
      if (error) throw error;
    }
  }

  return {
    pullTasks: (since) => pull<Task>('tasks', since),
    pushTasks: (rows) => push('tasks', rows),
    pullTags: (since) => pull<Tag>('tags', since),
    pushTags: (rows) => push('tags', rows as (Tag & Row)[]),
    pullDumps: (since) => pull<Dump>('dumps', since),
    pushDumps: (rows) => push('dumps', rows as (Dump & Row)[]),
  };
}

export const AUDIO_BUCKET = 'clear-audio';

/** Recordings in a private Storage bucket, one folder per user (enforced by RLS on storage.objects). */
export function createSupabaseAudio(storage: SupabaseClient['storage'], userId: string): AudioRemote {
  const bucket = () => storage.from(AUDIO_BUCKET);
  const path = (id: string) => `${userId}/${id}`;
  return {
    async upload(id, blob) {
      const { error } = await bucket().upload(path(id), blob, { upsert: true, contentType: blob.type || 'audio/webm' });
      if (error) throw error;
    },
    async download(id) {
      const { data, error } = await bucket().download(path(id));
      return error ? null : data;
    },
    async remove(id) {
      const { error } = await bucket().remove([path(id)]);
      if (error) throw error;
    },
  };
}
