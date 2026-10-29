import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SortMode } from '../domain/sort';
import type { ViewId } from '../domain/views';

export type { ViewId };

export const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'now', label: 'Now' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'inbox', label: 'Inbox' },
];

interface ViewState {
  view: ViewId;
  setView: (v: ViewId) => void;
  /** Per-view sort and tag filter, remembered across sessions. */
  sort: Partial<Record<ViewId, SortMode>>;
  reverseEffort: boolean;
  tagFilter: Partial<Record<ViewId, string[]>>;
  setSort: (v: ViewId, s: SortMode) => void;
  toggleReverseEffort: () => void;
  setTagFilter: (v: ViewId, ids: string[]) => void;
  search: string;
  setSearch: (q: string) => void;
}

export const useView = create<ViewState>()(
  persist(
    (set) => ({
      view: 'now',
      setView: (view) => set({ view, search: '' }),
      sort: {},
      reverseEffort: false,
      tagFilter: {},
      setSort: (v, s) => set((st) => ({ sort: { ...st.sort, [v]: s } })),
      toggleReverseEffort: () => set((st) => ({ reverseEffort: !st.reverseEffort })),
      setTagFilter: (v, ids) => set((st) => ({ tagFilter: { ...st.tagFilter, [v]: ids } })),
      search: '',
      setSearch: (search) => set({ search }),
    }),
    {
      name: 'clear-view-prefs',
      partialize: (s) => ({ sort: s.sort, tagFilter: s.tagFilter, reverseEffort: s.reverseEffort }),
    },
  ),
);
