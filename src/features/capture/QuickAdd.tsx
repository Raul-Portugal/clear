import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Plus } from 'lucide-react';
import { createTask } from '../../data/repo';
import { ensureTags } from '../../data/tags';
import { Chip } from '../../ui/Chip';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { formatDue } from '../../domain/dates';
import { parseQuickAdd, type TokenKind } from '../../domain/parseQuickAdd';
import { useTags } from '../filters/useTags';
import { toastWithUndo, useUi } from '../tasks/actions';
import styles from './QuickAdd.module.css';

/** `onDismiss` makes the row temporary (mobile): it goes away when left empty. */
function QuickInput({ autoFocus, onDismiss }: { autoFocus?: boolean; onDismiss?: () => void }) {
  const [text, setText] = useState('');
  const [ignored, setIgnored] = useState<TokenKind[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const tags = useTags();

  useEffect(() => {
    if (autoFocus && document.activeElement !== ref.current) ref.current?.focus();
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
    <div className={`${styles.wrap} ${onDismiss ? styles.temp : ''}`}>
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
          enterKeyHint="enter"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
            if (e.key === 'Escape') {
              setText('');
              setIgnored([]);
              ref.current?.blur();
              onDismiss?.();
            }
          }}
          onBlur={(e) => {
            // tapping a chip keeps the row; leaving it empty anywhere else closes it
            if (!text.trim() && !e.currentTarget.closest(`.${styles.wrap}`)?.contains(e.relatedTarget)) onDismiss?.();
          }}
        />
        {!text && <span className={styles.hint}>!high ~quick #tag</span>}
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

/** Desktop: inline input atop the list. Mobile: the FAB opens the same input in place, atop the list. */
export function QuickAdd() {
  const desktop = useIsDesktop();
  const { quickAdd, setQuickAdd } = useUi();
  const held = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (desktop) return <QuickInput />;
  return (
    <>
      {quickAdd && <QuickInput autoFocus onDismiss={() => setQuickAdd(false)} />}
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
        onClick={() => {
          if (held.current) return;
          // render and focus inside the tap itself: iOS only raises the keyboard for a focus made during a user gesture
          flushSync(() => setQuickAdd(true));
          const input = document.getElementById('quick-add');
          input?.focus({ preventScroll: true });
          input?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }}
      >
        <Plus size={26} strokeWidth={2} />
      </button>
    </>
  );
}
