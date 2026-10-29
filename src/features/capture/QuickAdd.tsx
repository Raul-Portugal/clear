import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { createTask } from '../../data/repo';
import { ensureTags } from '../../data/tags';
import { Sheet } from '../../ui/Sheet';
import { Chip } from '../../ui/Chip';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { formatDue } from '../../domain/dates';
import { parseQuickAdd, type TokenKind } from '../../domain/parseQuickAdd';
import { useTags } from '../filters/useTags';
import { toastWithUndo, useUi } from '../tasks/actions';
import styles from './QuickAdd.module.css';

function QuickInput({ autoFocus, inSheet }: { autoFocus?: boolean; inSheet?: boolean }) {
  const [text, setText] = useState('');
  const [ignored, setIgnored] = useState<TokenKind[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const tags = useTags();

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const parsed = useMemo(() => parseQuickAdd(text, tags, new Date()), [text, tags]);
  const active = parsed.tokens.filter((t) => !ignored.includes(t.kind));
  const has = (k: TokenKind) => !ignored.includes(k);

  /** Title = input minus the tokens that are still parsed. */
  function titleOf(): string {
    let out = '';
    let pos = 0;
    for (const t of [...active].sort((a, b) => a.start - b.start)) {
      out += text.slice(pos, t.start);
      pos = t.end;
    }
    return (out + text.slice(pos)).replace(/\s+/g, ' ').trim();
  }

  async function submit() {
    const title = titleOf();
    if (!title) return;
    const waiting = has('waiting') && parsed.status === 'waiting';
    const tagIds = has('tag') ? await ensureTags(parsed.tags) : [];
    setText('');
    setIgnored([]);
    await createTask({
      title,
      due: has('due') ? parsed.due : undefined,
      urgency: has('urgency') ? parsed.urgency : 0,
      effort: has('effort') ? parsed.effort : undefined,
      tagIds,
      ...(waiting ? { status: 'waiting' as const, waiting: { on: parsed.waitingOn } } : {}),
    });
    toastWithUndo('Added');
  }

  const chips: { kind: TokenKind; label: string }[] = [];
  if (has('due') && parsed.due)
    chips.push({ kind: 'due', label: formatDue(parsed.due, new Date()) });
  if (has('urgency') && parsed.urgency > 0)
    chips.push({ kind: 'urgency', label: ['', 'low', 'medium', 'high'][parsed.urgency] });
  if (has('effort') && parsed.effort) chips.push({ kind: 'effort', label: parsed.effort });
  if (has('tag')) for (const t of parsed.tags) chips.push({ kind: 'tag', label: `#${t}` });
  if (has('waiting') && parsed.status === 'waiting')
    chips.push({
      kind: 'waiting',
      label: parsed.waitingOn ? `waiting on ${parsed.waitingOn}` : 'waiting',
    });

  return (
    <div className={`${styles.wrap} ${inSheet ? styles.sheetWrap : ''}`}>
      <div className={styles.field}>
        <span className={styles.plus} aria-hidden>
          <Plus size={20} strokeWidth={2} />
        </span>
        <input
          ref={ref}
          id="quick-add"
          className={styles.input}
          value={text}
          placeholder="Add a task"
          aria-label="Add a task"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
            if (e.key === 'Escape') {
              setText('');
              setIgnored([]);
              ref.current?.blur();
            }
          }}
        />
        {!inSheet && !text && <span className={styles.hint}>!high ~quick #tag</span>}
      </div>
      {chips.length > 0 && (
        <div className={styles.chips}>
          {chips.map((c, i) => (
            <Chip key={i} selected onClick={() => setIgnored((x) => [...x, c.kind])}>
              {c.label}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

/** Desktop: inline input atop the list. Mobile: FAB that opens a bottom sheet. */
export function QuickAdd() {
  const desktop = useIsDesktop();
  const { quickAdd, setQuickAdd } = useUi();
  const held = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (desktop) return <QuickInput />;
  return (
    <>
      <button
        type="button"
        className={styles.fab}
        aria-label="Add task"
        onPointerDown={() => {
          held.current = false;
          timer.current = setTimeout(() => {
            held.current = true;
            useUi.getState().set({ brainDump: true, autoListen: true });
          }, 500);
        }}
        onPointerUp={() => clearTimeout(timer.current)}
        onPointerLeave={() => clearTimeout(timer.current)}
        onClick={() => !held.current && setQuickAdd(true)}
      >
        <Plus size={26} strokeWidth={2} />
      </button>
      <Sheet open={quickAdd} onClose={() => setQuickAdd(false)} title="New task">
        <QuickInput autoFocus inSheet />
      </Sheet>
    </>
  );
}
