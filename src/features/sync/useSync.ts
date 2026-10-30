import { useEffect } from 'react';
import { create } from 'zustand';
import { liveQuery } from 'dexie';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { db } from '../../data/db';
import { createSyncEngine } from '../../data/sync';
import { TABLES, createSupabaseRemote, getSupabase, syncConfigured } from '../../data/supabase';
import { useToast } from '../../ui/Toast';
import { authLinkError } from './authLink';

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'error';

interface SyncState {
  status: SyncStatus;
  email: string | null;
  lastSyncedAt: number | null;
  linkSent: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

let trigger: () => void = () => {};
let teardown: () => void = () => {};

export const useSync = create<SyncState>(() => ({
  status: syncConfigured ? 'signed-out' : 'off',
  email: null,
  lastSyncedAt: null,
  linkSent: false,
  async signIn(email) {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL, shouldCreateUser: true },
    });
    if (error) throw error;
    useSync.setState({ linkSent: true });
  },
  async signOut() {
    teardown();
    teardown = () => {};
    await getSupabase()?.auth.signOut();
    useSync.setState({ status: 'signed-out', email: null, lastSyncedAt: null, linkSent: false });
  },
  async syncNow() {
    trigger();
  },
}));

function startForUser(userId: string, email: string | null): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const engine = createSyncEngine(createSupabaseRemote(sb), { cursorKey: 'clear-sync-cursor:' + userId });
  const set = useSync.setState;
  set({ email, status: 'syncing', linkSent: false });

  let stopped = false;
  const run = async () => {
    if (stopped) return;
    set({ status: 'syncing' });
    try {
      await engine.syncOnce();
      if (!stopped) set({ status: 'synced', lastSyncedAt: Date.now() });
    } catch {
      if (!stopped) set({ status: 'error' });
    }
  };
  trigger = () => void run();

  const stopEngine = engine.start();
  void run();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), 1500);
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') void run();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('online', onVisible);

  // Local changes: watch the newest updatedAt of each table. The first emission is the baseline.
  const subs = (['tasks', 'tags', 'dumps'] as const).map((name) => {
    let first = true;
    let last = 0;
    return liveQuery(async () => {
      const rows = await db.table(name).orderBy('updatedAt').reverse().limit(1).toArray();
      return (rows[0]?.updatedAt as number | undefined) ?? 0;
    }).subscribe({
      next: (v) => {
        if (first) {
          first = false;
          last = v;
          return;
        }
        if (v !== last) {
          last = v;
          debounced();
        }
      },
      error: () => {},
    });
  });

  let channel: RealtimeChannel | null = null;
  try {
    channel = sb.channel('clear-sync-' + userId);
    for (const table of Object.values(TABLES)) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` }, () =>
        debounced(),
      );
    }
    channel.subscribe();
  } catch {
    channel = null;
  }

  return () => {
    stopped = true;
    clearTimeout(timer);
    stopEngine();
    subs.forEach((s) => s.unsubscribe());
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener('online', onVisible);
    if (channel) void sb.removeChannel(channel);
    trigger = () => {};
  };
}

/** Mount once. Follows the Supabase auth session and keeps the sync engine running while signed in. */
export function useSyncLifecycle(): void {
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    // A failed magic link lands here with the error in the hash: say so, and clear it from the address bar.
    const linkError = authLinkError(window.location.hash);
    if (linkError) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      useToast.getState().show(linkError);
    }
    let currentId: string | null = null;
    const apply = (user: { id: string; email?: string } | null) => {
      if (user?.id === currentId) return;
      teardown();
      teardown = () => {};
      currentId = user?.id ?? null;
      if (user) teardown = startForUser(user.id, user.email ?? null);
      else useSync.setState({ status: 'signed-out', email: null });
    };
    void sb.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, session) => apply(session?.user ?? null));
    return () => {
      data.subscription.unsubscribe();
      teardown();
      teardown = () => {};
    };
  }, []);
}
