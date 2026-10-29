import { useEffect, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { db } from '../data/db';
import { setWaiting, updateTask } from '../data/repo';
import type { Effort, Urgency } from '../domain/types';
import { completeTask, toastWithUndo, undo, useUi } from '../features/tasks/actions';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { useView, type ViewId } from './views';
import styles from './Shortcuts.module.css';

export const SHORTCUTS: [string, string][] = [
  ['n', 'Quick add'],
  ['b', 'Brain dump'],
  ['/', 'Search'],
  ['j / k', 'Move selection'],
  ['Enter', 'Open details'],
  ['x / Space', 'Complete'],
  ['w', 'Toggle waiting'],
  ['0–3', 'Set urgency'],
  ['e', 'Cycle effort'],
  ['t', 'Tags'],
  ['d', 'Due date'],
  ['Alt + ↑ / ↓', 'Reorder'],
  ['Ctrl/⌘ K', 'Command palette'],
  ['Ctrl/⌘ Z', 'Undo'],
  ['?', 'This cheat sheet'],
];

const NEXT_EFFORT: Record<string, Effort | undefined> = { none: 'quick', quick: 'medium', medium: 'deep', deep: undefined };

function focusSoon(id: string) {
  setTimeout(() => document.getElementById(id)?.focus(), 350);
}

export function Shortcuts() {
  const ui = useUi();
  const desktop = useIsDesktop();

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.matches('input, textarea, select, [contenteditable]');
      const st = useUi.getState();
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        st.set({ palette: !st.palette });
        return;
      }
      if (typing || mod || st.palette || st.cheatSheet) return;

      const ids = st.visibleIds;
      const idx = st.selectedId ? ids.indexOf(st.selectedId) : -1;
      const select = (i: number) => {
        const id = ids[Math.max(0, Math.min(ids.length - 1, i))];
        if (id) {
          st.set({ selectedId: id });
          document.querySelector(`[data-task-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
        }
      };
      const task = st.selectedId ? await db.tasks.get(st.selectedId) : undefined;

      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && task) {
        e.preventDefault();
        const { moveTask } = await import('../data/reorder');
        const moved = await moveTask(task.id, ids, e.key === 'ArrowUp' ? -1 : 1);
        const vs = useView.getState();
        if (moved && (vs.sort[vs.view] ?? 'smart') !== 'manual') {
          vs.setSort(vs.view, 'manual');
          toastWithUndo('Moved, now sorted manually');
        }
        return;
      }

      switch (e.key) {
        case 'n':
          e.preventDefault();
          useView.getState().setView('now');
          if (desktop) document.getElementById('quick-add')?.focus();
          else st.setQuickAdd(true);
          break;
        case 'b':
          e.preventDefault();
          st.set({ brainDump: true, dumpId: null });
          break;
        case '/':
          e.preventDefault();
          st.set({ searching: true });
          break;
        case '?':
          st.set({ cheatSheet: true });
          break;
        case 'j':
        case 'ArrowDown':
          select(idx + 1);
          break;
        case 'k':
        case 'ArrowUp':
          select(idx < 0 ? 0 : idx - 1);
          break;
        case 'Enter':
          if (task) st.openDetail(task.id);
          break;
        case 'x':
        case ' ':
          if (task) {
            e.preventDefault();
            await completeTask(task, task.status !== 'done');
          }
          break;
        case 'w':
          if (task) {
            await setWaiting(task.id, task.status !== 'waiting');
            toastWithUndo(task.status === 'waiting' ? 'Back to open' : 'Marked waiting');
          }
          break;
        case '0':
        case '1':
        case '2':
        case '3':
          if (task) await updateTask(task.id, { urgency: Number(e.key) as Urgency }, 'Urgency changed');
          break;
        case 'e':
          if (task) await updateTask(task.id, { effort: NEXT_EFFORT[task.effort ?? 'none'] }, 'Effort changed');
          break;
        case 't':
          if (task) {
            e.preventDefault();
            st.openDetail(task.id);
            focusSoon('new-tag');
          }
          break;
        case 'd':
          if (task) {
            e.preventDefault();
            st.openDetail(task.id);
            focusSoon('due-date');
          }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [desktop]);

  return (
    <>
      <Sheet open={ui.cheatSheet} onClose={() => ui.set({ cheatSheet: false })} title="Keyboard shortcuts">
        <dl className={styles.list}>
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className={styles.item}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Sheet>
      <Palette />
    </>
  );
}

interface Cmd {
  id: string;
  label: string;
  run: () => void;
}

function Palette() {
  const open = useUi((s) => s.palette);
  const set = useUi((s) => s.set);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const [titles, setTitles] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    void db.tasks.toArray().then((all) => setTitles(all.filter((t) => !t.deletedAt).map((t) => ({ id: t.id, title: t.title }))));
  }, [open]);

  const go = (v: ViewId) => () => useView.getState().setView(v);
  const base: Cmd[] = [
    { id: 'add', label: 'New task', run: () => (document.getElementById('quick-add') ? document.getElementById('quick-add')?.focus() : set({ quickAdd: true })) },
    { id: 'dump', label: 'Brain dump', run: () => set({ brainDump: true, dumpId: null }) },
    { id: 'now', label: 'Go to Now', run: go('now') },
    { id: 'up', label: 'Go to Upcoming', run: go('upcoming') },
    { id: 'wait', label: 'Go to Waiting', run: go('waiting') },
    { id: 'done', label: 'Go to Done', run: go('done') },
    { id: 'inbox', label: 'Go to Inbox', run: go('inbox') },
    { id: 'undo', label: 'Undo', run: () => void undo() },
    { id: 'search', label: 'Search', run: () => set({ searching: true }) },
    { id: 'help', label: 'Keyboard shortcuts', run: () => set({ cheatSheet: true }) },
  ];
  const needle = q.trim().toLowerCase();
  const cmds: Cmd[] = [
    ...base.filter((c) => c.label.toLowerCase().includes(needle)),
    ...(needle ? titles.filter((t) => t.title.toLowerCase().includes(needle)).slice(0, 8).map((t) => ({ id: t.id, label: t.title, run: () => set({ detailId: t.id }) })) : []),
  ];

  const run = (c?: Cmd) => {
    if (!c) return;
    set({ palette: false });
    setTimeout(c.run, 0);
  };

  return (
    <Sheet open={open} onClose={() => set({ palette: false })} title="Command palette">
      <input
        autoFocus
        className={styles.input}
        placeholder="Type a command or task"
        aria-label="Command"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setI(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setI((x) => Math.min(cmds.length - 1, x + 1));
          if (e.key === 'ArrowUp') setI((x) => Math.max(0, x - 1));
          if (e.key === 'Enter') run(cmds[i]);
        }}
      />
      <ul className={styles.cmds} role="listbox">
        {cmds.map((c, n) => (
          <li key={c.id} role="option" aria-selected={n === i}>
            <button type="button" className={`${styles.cmd} ${n === i ? styles.on : ''}`} onClick={() => run(c)}>
              {c.label}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
