import { useEffect, useMemo, useRef } from 'react';
import { Ellipsis, NotebookPen, Search } from 'lucide-react';
import { Inbox } from '../features/capture/Inbox';
import { VIEWS, useView } from './views';
import { useTasks } from '../features/tasks/useTasks';
import { TaskList } from '../features/tasks/TaskList';
import { TaskDetail } from '../features/tasks/TaskDetail';
import { QuickAdd } from '../features/capture/QuickAdd';
import { ViewMenu } from '../features/filters/ViewMenu';
import { tagColor, useTags } from '../features/filters/useTags';
import { Chip } from '../ui/Chip';
import { toastWithUndo, useUi } from '../features/tasks/actions';
import { sortTasks } from '../domain/sort';
import { planReorder } from '../domain/reorderList';
import { setOrders } from '../data/repo';
import { filterByTags, groupByDay, groupNow, searchTasks, selectView, type TaskGroup } from '../domain/views';
import type { ViewId } from '../domain/views';
import styles from './Main.module.css';

const EMPTY: Record<ViewId, string> = {
  now: 'Nothing left. Nice.',
  upcoming: 'Nothing scheduled.',
  waiting: 'Not waiting on anything.',
  done: 'Nothing completed yet.',
  inbox: '',
};

export function Main() {
  const { view, sort, setSort, reverseEffort, tagFilter, setTagFilter, search, setSearch } = useView();
  const tasks = useTasks();
  const tags = useTags();
  const { menu, searching, set } = useUi();
  const setMenu = (v: boolean) => set({ menu: v });
  const setSearching = (v: boolean) => set({ searching: v });
  const pull = useRef<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const activeTags = useMemo(() => tagFilter[view] ?? [], [tagFilter, view]);
  const groups: TaskGroup[] = useMemo(() => {
    if (!tasks) return [];
    const now = new Date();
    let list = selectView(view, tasks, now);
    list = searchTasks(filterByTags(list, activeTags), search);
    if (view === 'done') return [{ key: 'all', tasks: list }];
    const sorted = sortTasks(list, sort[view] ?? (view === 'upcoming' ? 'due' : 'smart'), now, { reverseEffort });
    if (view === 'now') return groupNow(sorted, now);
    if (view === 'upcoming') return groupByDay(sorted, (t) => t.due?.date, now);
    return groupByDay(sorted, (t) => t.waiting?.followUp, now);
  }, [tasks, view, sort, reverseEffort, activeTags, search]);

  const flatIds = groups.flatMap((g) => g.tasks.map((t) => t.id)).join(',');
  useEffect(() => {
    set({ visibleIds: flatIds ? flatIds.split(',') : [] });
  }, [flatIds, set]);

  /** Drag-drop within a group: re-key against the whole visible sequence, then switch to Manual. */
  async function move(id: string, group: TaskGroup, to: number) {
    const flat = groups.flatMap((g) => g.tasks);
    const offset = flat.indexOf(group.tasks[0]);
    const changes = planReorder(flat, flat.findIndex((t) => t.id === id), offset + to);
    await setOrders(changes);
    const manual = (sort[view] ?? (view === 'upcoming' ? 'due' : 'smart')) === 'manual';
    if (!manual) setSort(view, 'manual');
    toastWithUndo(manual ? 'Moved' : 'Moved, now sorted manually');
  }

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const title = view === 'done' ? 'Done' : VIEWS.find((v) => v.id === view)?.label;
  const pills = tags.filter((t) => activeTags.includes(t.id));
  const empty = groups.every((g) => g.tasks.length === 0);

  return (
    <div
      className={styles.col}
      onTouchStart={(e) => {
        pull.current = window.scrollY === 0 && (e.currentTarget.parentElement?.scrollTop ?? 0) === 0 ? e.touches[0].clientY : null;
      }}
      onTouchEnd={(e) => {
        if (pull.current !== null && e.changedTouches[0].clientY - pull.current > 90) setSearching(true);
        pull.current = null;
      }}
    >
      <header className={styles.head}>
        <div className={styles.titles}>
          <h1 className={styles.h}>{title}</h1>
          {view === 'now' && <p className={styles.date}>{today}</p>}
          {view === 'inbox' && <p className={styles.date}>Thoughts to sort out later</p>}
        </div>
        <button
          type="button"
          className={`${styles.icon} ${styles.dump}`}
          aria-label="Brain dump"
          onClick={() => set({ brainDump: true, dumpId: null })}
        >
          <NotebookPen size={20} strokeWidth={1.5} />
          <span className={styles.dumpLabel}>Brain dump</span>
        </button>
        {view !== 'inbox' && (
        <button type="button" className={styles.icon} aria-label="Search" onClick={() => setSearching(true)}>
          <Search size={20} strokeWidth={1.5} />
        </button>
        )}
        <button type="button" className={styles.icon} aria-label="View options" onClick={() => setMenu(true)}>
          <Ellipsis size={20} strokeWidth={1.5} />
        </button>
      </header>
      {searching && (
        <input
          ref={searchRef}
          className={styles.search}
          value={search}
          placeholder="Search"
          aria-label="Search tasks"
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSearch('');
              setSearching(false);
            }
          }}
          onBlur={() => !search && setSearching(false)}
        />
      )}
      {pills.length > 0 && (
        <div className={styles.pills}>
          {pills.map((t) => (
            <Chip
              key={t.id}
              color={tagColor(t.color)}
              selected
              onRemove={() => setTagFilter(view, activeTags.filter((x) => x !== t.id))}
            >
              #{t.name}
            </Chip>
          ))}
        </div>
      )}
      {view === 'now' && <QuickAdd />}
      {view === 'inbox' && <Inbox />}
      {tasks && view !== 'inbox' && empty && <TaskList tasks={[]} empty={EMPTY[view]} />}
      {groups.map(
        (g) =>
          g.tasks.length > 0 && (
            <section key={g.key} aria-label={g.heading}>
              {g.heading && <h2 className={styles.group}>{g.heading}</h2>}
              <TaskList tasks={g.tasks} empty="" onMove={view === 'done' ? undefined : (id, to) => void move(id, g, to)} />
            </section>
          ),
      )}
      <TaskDetail />
      <ViewMenu open={menu} onClose={() => setMenu(false)} />
    </div>
  );
}
