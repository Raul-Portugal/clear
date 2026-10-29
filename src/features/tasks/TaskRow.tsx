import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { GripVertical, Hourglass, ListChecks } from 'lucide-react';
import { Checkbox } from '../../ui/Checkbox';
import { Bars } from '../../ui/Bars';
import { formatDue, isOverdue } from '../../domain/dates';
import type { Tag, Task } from '../../domain/types';
import { SwipeRow } from '../../ui/SwipeRow';
import { setSubtasks } from '../../data/repo';
import { SubtaskPills } from './SubtaskPills';
import { tagColor } from '../filters/useTags';
import { completeTask, deleteTask, useUi } from './actions';
import { effortOf, urgencyOf } from './levels';
import styles from './TaskRow.module.css';

interface Props {
  task: Task;
  /** All tags, loaded once by the list (one live query instead of one per row). */
  tags: Tag[];
  /** Called when a drag ends; `moved` is false when the row was lifted and dropped in place. */
  onDrop?: (id: string, moved: boolean) => void;
  dragging?: boolean;
  onLift?: (id: string) => void;
}

function TaskRowBase({ task, tags, onDrop, onLift, dragging }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const openDetail = useUi((s) => s.openDetail);
  const selected = useUi((s) => s.selectedId === task.id);
  const controls = useDragControls();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ref = useRef<HTMLLIElement>(null);
  const lifted = useRef(false);
  const justLifted = useRef(false);
  const now = new Date();

  // While lifted on touch, stop the page from scrolling so the finger drags the row.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const block = (e: TouchEvent) => lifted.current && e.preventDefault();
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  const done = task.status === 'done';
  const checked = done || leaving;
  const overdue = !done && isOverdue(task.due, now);
  const subDone = task.subtasks.filter((s) => s.done).length;
  const urg = urgencyOf(task.urgency);
  const eff = task.effort ? effortOf(task.effort) : undefined;
  const taskTags = tags.filter((t) => task.tagIds.includes(t.id));
  const hasMeta = task.status === 'waiting' || !!task.due || taskTags.length > 0 || task.subtasks.length > 0;

  function toggle(next: boolean) {
    if (next && !done) {
      // fill the checkbox + strike the title, then collapse
      setLeaving(true);
      timer.current = setTimeout(() => {
        void completeTask(task, true);
      }, 300);
    } else {
      clearTimeout(timer.current);
      setLeaving(false);
      void completeTask(task, next);
    }
  }

  function lift(e: PointerEvent | React.PointerEvent, from: 'hold' | 'grip') {
    if (!onDrop) return;
    lifted.current = true;
    justLifted.current = true;
    onLift?.(task.id);
    controls.start(e);
    window.addEventListener(
      'pointerup',
      () =>
        setTimeout(() => {
          setTimeout(() => (justLifted.current = false), 50);
          if (!lifted.current) return; // a real drag ended through onDragEnd
          lifted.current = false;
          onDrop(task.id, false);
          if (from === 'hold') openDetail(task.id);
        }),
      { once: true },
    );
  }

  return (
    <Reorder.Item
      as="li"
      ref={ref}
      value={task.id}
      dragListener={false}
      dragControls={controls}
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, scale: dragging ? 1.02 : 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ default: { duration: 0.18 }, layout: { type: 'spring', stiffness: 700, damping: 50, mass: 0.6 } }}
      onDragEnd={() => {
        const wasLifted = lifted.current;
        lifted.current = false;
        if (wasLifted) onDrop?.(task.id, true);
      }}
      className={`${styles.row} ${selected ? styles.selected : ''} ${dragging ? styles.dragging : ''}`}
      style={{ '--urg': urg.color, '--urg-soft': urg.soft } as CSSProperties}
      data-task-id={task.id}
    >
      {onDrop && (
        <button
          type="button"
          className={styles.grip}
          aria-hidden
          tabIndex={-1}
          onPointerDown={(e) => {
            e.preventDefault();
            lift(e, 'grip');
          }}
        >
          <GripVertical size={16} strokeWidth={1.5} />
        </button>
      )}
      <SwipeRow
        locked={dragging}
        onComplete={() => void completeTask(task, !done)}
        onDelete={() => void deleteTask(task)}
        onLongPress={(e) => (onDrop ? lift(e, 'hold') : openDetail(task.id))}
      >
        <div className={styles.card}>
          <div className={styles.line}>
            <Checkbox checked={checked} onChange={toggle} label={`Complete ${task.title}`} />
            <button
              type="button"
              className={styles.body}
              aria-expanded={task.subtasks.length > 0 ? expanded : undefined}
              onClick={() => {
                if (justLifted.current) return;
                // with subtasks: first click reveals them, the next opens the details
                if (task.subtasks.length > 0 && !expanded) setExpanded(true);
                else {
                  setExpanded(false);
                  openDetail(task.id);
                }
              }}
            >
              <span data-testid="task-title" className={`${styles.title} ${checked ? styles.struck : ''}`}>{task.title}</span>
              {hasMeta && (
                <span className={styles.meta}>
                  {task.status === 'waiting' && (
                    <span className={styles.waiting}>
                      <Hourglass size={12} strokeWidth={1.75} aria-hidden />
                      {task.waiting?.on ? `Waiting on ${task.waiting.on}` : 'Waiting'}
                    </span>
                  )}
                  {task.due && <span className={overdue ? styles.overdue : undefined}>{formatDue(task.due, now)}</span>}
                  {taskTags.map((t) => (
                    <span key={t.id} style={{ color: tagColor(t.color) }}>
                      #{t.name}
                    </span>
                  ))}
                  {task.subtasks.length > 0 && (
                    <span className={styles.progress}>
                      <ListChecks size={12} strokeWidth={1.75} aria-hidden />
                      {subDone}/{task.subtasks.length}
                    </span>
                  )}
                </span>
              )}
            </button>
            {(task.urgency > 0 || eff) && (
              <span className={styles.badges}>
                {task.urgency > 0 && (
                  <span className={styles.badge} role="img" aria-label={`${urg.label} urgency`}>
                    <span className={styles.dot} aria-hidden />
                    {urg.short}
                  </span>
                )}
                {eff && (
                  <span
                    className={styles.badge}
                    role="img"
                    aria-label={`${eff.label} effort`}
                    style={{ '--c': eff.color, '--c-soft': eff.soft } as CSSProperties}
                  >
                    <Bars level={eff.bars} />
                    <span className={styles.effText}>{eff.short}</span>
                  </span>
                )}
              </span>
            )}
          </div>
          {expanded && task.subtasks.length > 0 && (
            <ul className={styles.subs} aria-label={`Subtasks of ${task.title}`}>
              {task.subtasks.map((st) => (
                <li key={st.id} className={styles.sub}>
                  <Checkbox
                    checked={st.done}
                    label={`Complete ${st.title}`}
                    onChange={(done) =>
                      void setSubtasks(task.id, task.subtasks.map((x) => (x.id === st.id ? { ...x, done } : x)), 'Subtask toggled')
                    }
                  />
                  <button type="button" className={styles.subBody} onClick={() => openDetail(task.id)}>
                    <span className={`${styles.subTitle} ${st.done ? styles.struck : ''}`}>{st.title}</span>
                    <SubtaskPills s={st} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SwipeRow>
    </Reorder.Item>
  );
}

/** Memoized so a reorder re-renders only the rows whose own data changed, keeping drags at full frame rate. */
export const TaskRow = memo(TaskRowBase);
