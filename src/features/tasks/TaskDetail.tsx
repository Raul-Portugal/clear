import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValue } from 'motion/react';
import { CalendarDays, GripVertical, Hourglass, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Sheet } from '../../ui/Sheet';
import { Chip } from '../../ui/Chip';
import { Segmented } from '../../ui/Segmented';
import { Bars } from '../../ui/Bars';
import { Checkbox } from '../../ui/Checkbox';
import { SwipeRow } from '../../ui/SwipeRow';
import { useSortable, type Sortable } from '../../hooks/useSortable';
import { addSubtask, addTaskTag, setSubtasks, setWaiting, updateTask } from '../../data/repo';
import { ensureTag, ensureTags } from '../../data/tags';
import { parseQuickAdd } from '../../domain/parseQuickAdd';
import { SubtaskPills } from './SubtaskPills';
import { addDays, formatDue, isOverdue, toISODate } from '../../domain/dates';
import { tagColor, useTags } from '../filters/useTags';
import type { Effort, Subtask, Task, Urgency } from '../../domain/types';
import { deleteTask, useUi } from './actions';
import { EFFORT_LEVELS, URGENCY_LEVELS } from './levels';
import { useTasks } from './useTasks';
import styles from './TaskDetail.module.css';

const NO_EFFORT = 'none';

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.prop}>
      <span className={styles.label}>{label}</span>
      <div className={styles.value}>{children}</div>
    </div>
  );
}

/** A native date input hidden behind a pill, opened with showPicker where available. */
function DatePill({ value, label, onChange, aria }: { value: string; label: ReactNode; onChange: (v: string) => void; aria: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className={styles.datePill}>
      <button
        type="button"
        className={styles.pill}
        onClick={() => {
          try {
            ref.current?.showPicker();
          } catch {
            ref.current?.focus();
          }
        }}
      >
        {label}
      </button>
      <input ref={ref} type="date" aria-label={aria} className={styles.hiddenDate} value={value} onChange={(e) => onChange(e.target.value)} />
    </span>
  );
}

/** Same categorization controls as a task, for one subtask: urgency, effort, due, tags. */
function SubtaskProps({ s, onChange }: { s: Subtask; onChange: (p: Partial<Subtask>) => void }) {
  const tags = useTags();
  const today = toISODate(new Date());
  const own = s.tagIds ?? [];
  const toggleTag = (id: string) => onChange({ tagIds: own.includes(id) ? own.filter((x) => x !== id) : [...own, id] });
  const setDue = (date: string | undefined) => onChange({ due: date ? { date, time: s.due?.time } : undefined });
  return (
    <div className={styles.subProps}>
      <Prop label="Urgency">
        <Segmented<Urgency>
          label={`Urgency of ${s.title}`}
          value={s.urgency ?? 0}
          onChange={(v) => onChange({ urgency: v || undefined })}
          options={URGENCY_LEVELS.map((u) => ({
            value: u.v,
            label: u.v === 0 ? 'None' : u.short,
            color: u.v === 0 ? 'var(--text-muted)' : u.color,
            soft: u.v === 0 ? undefined : u.soft,
            icon: u.v > 0 ? <span className={styles.dot} style={{ background: u.color }} /> : undefined,
          }))}
        />
      </Prop>
      <Prop label="Effort">
        <Segmented<Effort | typeof NO_EFFORT>
          label={`Effort of ${s.title}`}
          value={s.effort ?? NO_EFFORT}
          onChange={(v) => onChange({ effort: v === NO_EFFORT ? undefined : v })}
          options={[
            { value: NO_EFFORT, label: '—', color: 'var(--text-muted)' },
            ...EFFORT_LEVELS.map((e) => ({ value: e.v, label: e.short, color: e.color, soft: e.soft, icon: <Bars level={e.bars} /> })),
          ]}
        />
      </Prop>
      <Prop label="Due">
        {s.due ? (
          <div className={styles.inline}>
            <DatePill
              aria={`Due date of ${s.title}`}
              value={s.due.date}
              onChange={(v) => setDue(v || undefined)}
              label={
                <span className={isOverdue(s.due, new Date()) ? styles.overdue : undefined}>
                  <CalendarDays size={14} strokeWidth={1.75} aria-hidden /> {formatDue({ date: s.due.date }, new Date())}
                </span>
              }
            />
            <button type="button" className={styles.clear} aria-label={`Clear due date of ${s.title}`} onClick={() => setDue(undefined)}>
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className={styles.inline}>
            <button type="button" className={styles.pill} onClick={() => setDue(today)}>
              Today
            </button>
            <button type="button" className={styles.pill} onClick={() => setDue(addDays(today, 1))}>
              Tomorrow
            </button>
            <DatePill
              aria={`Due date of ${s.title}`}
              value=""
              onChange={(v) => v && setDue(v)}
              label={
                <>
                  <CalendarDays size={14} strokeWidth={1.75} aria-hidden /> Pick
                </>
              }
            />
          </div>
        )}
      </Prop>
      {tags.length > 0 && (
        <Prop label="Tags">
          <div className={styles.inline}>
            {tags.map((t) => (
              <Chip key={t.id} color={tagColor(t.color)} selected={own.includes(t.id)} onClick={() => toggleTag(t.id)}>
                #{t.name}
              </Chip>
            ))}
          </div>
        </Prop>
      )}
    </div>
  );
}

function SubtaskRow({ task, s, dragging, sortable }: { task: Task; s: Subtask; dragging: boolean; sortable: Sortable }) {
  const ref = useRef<HTMLLIElement>(null);
  const y = useMotionValue(0);
  useEffect(() => {
    if (ref.current) return sortable.register(s.id, ref.current, y);
  }, [sortable, s.id, y]);
  const [title, setTitle] = useState(s.title);
  const [synced, setSynced] = useState(s.title);
  if (synced !== s.title) {
    setSynced(s.title);
    setTitle(s.title);
  }
  const [open, setOpen] = useState(false);
  const update = (p: Partial<Subtask>) =>
    void setSubtasks(task.id, task.subtasks.map((x) => (x.id === s.id ? { ...x, ...p } : x)), 'Subtask updated');
  const patch = (done: boolean) =>
    void setSubtasks(task.id, task.subtasks.map((x) => (x.id === s.id ? { ...x, done } : x)), 'Subtask toggled');
  const remove = () => void setSubtasks(task.id, task.subtasks.filter((x) => x.id !== s.id), 'Subtask deleted');
  const lift = (clientY: number, touch: boolean) => sortable.start(s.id, clientY, touch);
  return (
    <motion.li
      ref={ref}
      style={{ y }}
      className={`${styles.subRow} ${dragging ? styles.subDragging : ''}`}
    >
      <SwipeRow locked={dragging} onComplete={() => patch(!s.done)} onDelete={remove} onLongPress={(at) => lift(at.y, at.touch)}>
        <div className={styles.subCard}>
          <div className={styles.subLine}>
          <Checkbox checked={s.done} onChange={patch} label={`Complete ${s.title}`} />
          <input
            className={`${styles.subTitle} ${s.done ? styles.struck : ''}`}
            value={title}
            aria-label={`Subtask ${s.title}`}
            enterKeyHint="done"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setTitle(s.title);
                e.stopPropagation();
                e.currentTarget.blur();
              }
            }}
            onBlur={() => {
              const t = title.trim();
              if (t && t !== s.title) {
                void setSubtasks(task.id, task.subtasks.map((x) => (x.id === s.id ? { ...x, title: t } : x)), 'Subtask renamed');
              } else setTitle(s.title);
            }}
          />
          <button
            type="button"
            className={styles.subGrip}
            aria-hidden
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              lift(e.clientY, e.pointerType === 'touch');
            }}
          >
            <GripVertical size={14} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className={`${styles.subOpt} ${open ? styles.subOptOn : ''}`}
            aria-label={`Options for ${s.title}`}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <SlidersHorizontal size={14} strokeWidth={1.75} />
          </button>
          <button type="button" className={styles.subDel} aria-label={`Delete ${s.title}`} onClick={remove}>
            <X size={14} strokeWidth={2} />
          </button>
          </div>
          {!open && (
            <div className={styles.subMeta}>
              <SubtaskPills s={s} />
            </div>
          )}
          {open && <SubtaskProps s={s} onChange={update} />}
        </div>
      </SwipeRow>
    </motion.li>
  );
}

function Body({ task }: { task: Task }) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [sub, setSub] = useState('');
  const [tag, setTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [local, setLocal] = useState({ src: task.subtasks, list: task.subtasks });
  const subs = local.src === task.subtasks ? local.list : task.subtasks;
  const { listRef: subListRef, active: liftedSub, sortable: subSort } = useSortable({
    ids: subs.map((s) => s.id),
    onDrop: (id, to) => {
      const list = subs.filter((s) => s.id !== id);
      list.splice(to, 0, subs.find((s) => s.id === id)!);
      setLocal({ src: task.subtasks, list });
      void setSubtasks(task.id, list, 'Subtasks reordered');
    },
  });
  const tags = useTags();
  const today = toISODate(new Date());

  const setDue = (date: string | undefined) =>
    void updateTask(task.id, { due: date ? { date, time: task.due?.time } : undefined }, 'Due date changed');
  const toggleTag = (id: string) =>
    void updateTask(
      task.id,
      { tagIds: task.tagIds.includes(id) ? task.tagIds.filter((x) => x !== id) : [...task.tagIds, id] },
      'Tags changed',
    );
  // Adds the typed tag. Runs on Enter, on a space/comma, and on blur, because Android keyboards may
  // show Next (moves focus, no Enter) instead of Enter.
  const commitTag = (name: string) => {
    const clean = name.trim().replace(/^#/, '');
    if (!clean) return;
    void ensureTag(clean).then((t) => addTaskTag(task.id, t.id));
  };
  const own = tags.filter((t) => task.tagIds.includes(t.id));
  const others = tags.filter((t) => !task.tagIds.includes(t.id));

  return (
    <div className={styles.body}>
      <textarea
        className={styles.title}
        value={title}
        aria-label="Title"
        rows={1}
        onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        onBlur={() => {
          const t = title.trim();
          if (t && t !== task.title) void updateTask(task.id, { title: t }, 'Title changed');
          else setTitle(task.title);
        }}
      />

      <div className={styles.props}>
        <Prop label="Urgency">
          <Segmented<Urgency>
            label="Urgency"
            value={task.urgency}
            onChange={(v) => void updateTask(task.id, { urgency: v }, 'Urgency changed')}
            options={URGENCY_LEVELS.map((u) => ({
              value: u.v,
              label: u.v === 0 ? 'None' : u.short,
              color: u.v === 0 ? 'var(--text-muted)' : u.color,
              soft: u.v === 0 ? undefined : u.soft,
              icon: u.v > 0 ? <span className={styles.dot} style={{ background: u.color }} /> : undefined,
            }))}
          />
        </Prop>

        <Prop label="Effort">
          <Segmented<Effort | typeof NO_EFFORT>
            label="Effort"
            value={task.effort ?? NO_EFFORT}
            onChange={(v) => void updateTask(task.id, { effort: v === NO_EFFORT ? undefined : v }, 'Effort changed')}
            options={[
              { value: NO_EFFORT, label: '—', color: 'var(--text-muted)' },
              ...EFFORT_LEVELS.map((e) => ({ value: e.v, label: e.short, color: e.color, soft: e.soft, icon: <Bars level={e.bars} /> })),
            ]}
          />
        </Prop>

        <Prop label="Due">
          {task.due ? (
            <div className={styles.inline}>
              <DatePill
                aria="Due date"
                value={task.due.date}
                onChange={(v) => setDue(v || undefined)}
                label={
                  <span className={isOverdue(task.due, new Date()) ? styles.overdue : undefined}>
                    <CalendarDays size={14} strokeWidth={1.75} aria-hidden /> {formatDue({ date: task.due.date }, new Date())}
                  </span>
                }
              />
              <input
                type="time"
                aria-label="Due time"
                className={styles.time}
                value={task.due.time ?? ''}
                onChange={(e) =>
                  void updateTask(task.id, { due: { date: task.due!.date, time: e.target.value || undefined } }, 'Due time changed')
                }
              />
              <button type="button" className={styles.clear} aria-label="Clear due date" onClick={() => setDue(undefined)}>
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div className={styles.inline}>
              <button type="button" className={styles.pill} onClick={() => setDue(today)}>
                Today
              </button>
              <button type="button" className={styles.pill} onClick={() => setDue(addDays(today, 1))}>
                Tomorrow
              </button>
              <DatePill
                aria="Due date"
                value=""
                onChange={(v) => v && setDue(v)}
                label={
                  <>
                    <CalendarDays size={14} strokeWidth={1.75} aria-hidden /> Pick
                  </>
                }
              />
            </div>
          )}
        </Prop>

        <Prop label="Tags">
          <div className={styles.inline}>
            {own.map((t) => (
              <Chip key={t.id} color={tagColor(t.color)} selected onRemove={() => toggleTag(t.id)}>
                #{t.name}
              </Chip>
            ))}
            {addingTag ? (
              <input
                id="new-tag"
                autoFocus
                className={styles.newTag}
                value={tag}
                placeholder="tag name"
                aria-label="New tag"
                enterKeyHint="done"
                autoCapitalize="none"
                onChange={(e) => {
                  const v = e.target.value;
                  // A tag is one word: a space or comma finishes it and starts the next.
                  if (/[\s,]$/.test(v)) {
                    commitTag(v.replace(/[\s,]+$/, ''));
                    setTag('');
                  } else setTag(v);
                }}
                onBlur={() => {
                  commitTag(tag);
                  setTag('');
                  setAddingTag(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setTag('');
                    setAddingTag(false);
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitTag(tag);
                    setTag('');
                  }
                }}
              />
            ) : (
              <button type="button" className={styles.pill} aria-label="Add tag" onClick={() => setAddingTag(true)}>
                <Plus size={14} strokeWidth={2} aria-hidden /> {own.length ? '' : 'Add'}
              </button>
            )}
          </div>
          {addingTag && others.length > 0 && (
            // Keep focus in the tag field, or its blur would close these chips before the tap lands.
            <div className={styles.inline} onMouseDown={(e) => e.preventDefault()}>
              {others.map((t) => (
                <Chip key={t.id} color={tagColor(t.color)} onClick={() => toggleTag(t.id)}>
                  #{t.name}
                </Chip>
              ))}
            </div>
          )}
        </Prop>

        <Prop label="Waiting">
          <button
            type="button"
            role="switch"
            aria-checked={task.status === 'waiting'}
            aria-label="Waiting"
            className={`${styles.switch} ${task.status === 'waiting' ? styles.switchOn : ''}`}
            onClick={() => void setWaiting(task.id, task.status !== 'waiting', task.waiting?.on, task.waiting?.followUp)}
          >
            <span />
          </button>
          {task.status === 'waiting' && (
            <div className={styles.inline}>
              <input
                className={styles.textField}
                defaultValue={task.waiting?.on ?? ''}
                placeholder="On whom?"
                aria-label="Waiting on"
                onBlur={(e) =>
                  void updateTask(task.id, { waiting: { ...task.waiting, on: e.target.value.trim() || undefined } }, 'Waiting changed')
                }
              />
              <DatePill
                aria="Follow-up date"
                value={task.waiting?.followUp ?? ''}
                onChange={(v) =>
                  void updateTask(task.id, { waiting: { ...task.waiting, followUp: v || undefined } }, 'Follow-up changed')
                }
                label={
                  <>
                    <Hourglass size={14} strokeWidth={1.75} aria-hidden />
                    {task.waiting?.followUp ? `Follow up ${formatDue({ date: task.waiting.followUp }, new Date())}` : 'Follow-up'}
                  </>
                }
              />
            </div>
          )}
        </Prop>
      </div>

      <textarea
        className={styles.notes}
        value={notes}
        placeholder="Add notes…"
        aria-label="Notes"
        rows={2}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes !== (task.notes ?? '')) void updateTask(task.id, { notes: notes || undefined }, 'Notes changed');
        }}
      />

      <section className={styles.subs} aria-label="Subtasks">
        <h2 className={styles.h}>
          Subtasks
          {task.subtasks.length > 0 && (
            <span className={styles.count}>
              {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
            </span>
          )}
        </h2>
        <ul ref={subListRef} className={styles.subList}>
          {subs.map((s) => (
            <SubtaskRow key={s.id} task={task} s={s} dragging={liftedSub === s.id} sortable={subSort} />
          ))}
        </ul>
        <div className={styles.addSubRow}>
          <span className={styles.addPlus}>
            <Plus size={18} strokeWidth={2} aria-hidden />
          </span>
          <input
            className={styles.addSub}
            value={sub}
            placeholder="Add subtask (fri !high #tag)"
            aria-label="Add subtask"
            enterKeyHint="enter"
            onChange={(e) => setSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && sub.trim()) {
                const text = sub.trim();
                setSub('');
                void (async () => {
                  // same smart syntax as quick add: Pack bags fri !high #home ~quick
                  const p = parseQuickAdd(text, tags, new Date());
                  const tagIds = await ensureTags(p.tags);
                  await addSubtask(task.id, p.title || text, {
                    due: p.due,
                    urgency: p.urgency || undefined,
                    effort: p.effort,
                    tagIds: tagIds.length ? tagIds : undefined,
                  });
                })();
              }
            }}
          />
        </div>
      </section>

      <button type="button" className={styles.delete} onClick={() => void deleteTask(task)}>
        <Trash2 size={16} strokeWidth={1.75} aria-hidden /> Delete task
      </button>
    </div>
  );
}

export function TaskDetail() {
  const { detailId, openDetail } = useUi();
  const tasks = useTasks();
  const task = tasks?.find((t) => t.id === detailId);

  // close if the task disappears (deleted / undone)
  useEffect(() => {
    if (detailId && tasks && !task) openDetail(null);
  }, [detailId, tasks, task, openDetail]);

  return (
    <Sheet open={!!task} onClose={() => openDetail(null)} title="Task details" side>
      {task && <Body key={task.id} task={task} />}
    </Sheet>
  );
}
