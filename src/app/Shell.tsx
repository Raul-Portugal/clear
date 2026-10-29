import { useMemo } from 'react';
import { CalendarDays, CircleCheck, Hourglass, Inbox, Sun, type LucideIcon } from 'lucide-react';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { selectView, type ViewId } from '../domain/views';
import { useDumps } from '../features/capture/useDumps';
import { useTasks } from '../features/tasks/useTasks';
import { VIEWS, useView } from './views';
import { Main } from './Main';
import styles from './Shell.module.css';

const ICONS: Record<ViewId, LucideIcon> = { now: Sun, upcoming: CalendarDays, waiting: Hourglass, done: CircleCheck, inbox: Inbox };

/** Bottom bar on phone/tablet, left rail on desktop. */
export function Shell() {
  const desktop = useIsDesktop();
  const { view, setView } = useView();
  const tasks = useTasks();
  const dumps = useDumps();
  const counts = useMemo(() => {
    const now = new Date();
    return {
      ...Object.fromEntries(VIEWS.map((v) => [v.id, tasks ? selectView(v.id, tasks, now).length : 0])),
      inbox: dumps?.length ?? 0,
    } as Record<ViewId, number>;
  }, [tasks, dumps]);

  const item = (id: ViewId, label: string, extra = '') => {
    const Icon = ICONS[id];
    return (
      <button
        key={id}
        type="button"
        className={`${styles.item} ${extra} ${view === id ? styles.active : ''}`}
        aria-current={view === id ? 'page' : undefined}
        onClick={() => setView(id)}
      >
        <span className={styles.iconWrap}>
          <Icon size={desktop ? 18 : 22} strokeWidth={view === id ? 2 : 1.5} aria-hidden />
          {!desktop && id === 'inbox' && counts.inbox > 0 && <span className={styles.badge} aria-hidden />}
        </span>
        <span className={styles.label}>{label}</span>
        {desktop && counts[id] > 0 && <span className={styles.count}>{counts[id]}</span>}
      </button>
    );
  };

  const nav = (
    <nav className={styles.nav} aria-label="Views">
      {desktop && (
        <div className={styles.brand} aria-hidden>
          <span className={styles.logo} />
          Clear
        </div>
      )}
      {VIEWS.map((v) => item(v.id, v.label))}
      {desktop && item('done', 'Done', styles.done)}
    </nav>
  );

  return (
    <div className={desktop ? styles.desktop : styles.mobile}>
      {desktop && nav}
      <main className={styles.main}>
        <Main />
      </main>
      {!desktop && nav}
    </div>
  );
}
