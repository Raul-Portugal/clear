import { useEffect, useRef, useState } from 'react';
import { ArrowUp, CornerDownRight, Mic } from 'lucide-react';
import { Sheet } from '../../ui/Sheet';
import { Button } from '../../ui/Button';
import { addClip, createDump, discardIfEmpty, organizeDump, removeClip, updateDumpText } from '../../data/dumps';
import { useVoice } from '../../hooks/useVoice';
import { formatDue } from '../../domain/dates';
import { appendText, formatElapsed } from '../../domain/transcript';
import { useSettings } from '../../app/settings';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import type { ProposedTask } from '../../domain/proposed';
import { useTags } from '../filters/useTags';
import { toastWithUndo, useUi } from '../tasks/actions';
import { useToast } from '../../ui/Toast';
import { ClipPlayer } from './ClipPlayer';
import { useDump } from './useDumps';
import { organize } from './organize';
import styles from './BrainDump.module.css';

interface Card extends ProposedTask {
  included: boolean;
}

function metaOf(p: ProposedTask): string {
  const bits: string[] = [];
  if (p.due) bits.push(formatDue(p.due, new Date()));
  if (p.urgency === 3) bits.push('high');
  else if (p.urgency === 2) bits.push('medium');
  else if (p.urgency === 1) bits.push('low');
  if (p.effort) bits.push(p.effort);
  if (p.status === 'waiting') bits.push(p.waitingOn ? `waiting on ${p.waitingOn}` : 'waiting');
  bits.push(...p.tags.map((t) => `#${t}`));
  if (p.subtasks.length) bits.push(`${p.subtasks.length} subtasks`);
  return bits.join(' · ');
}

/** A quiet m:ss next to the waveform, so a long recording visibly keeps going. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className={styles.time}>{formatElapsed(now - since)}</span>;
}

/**
 * The editor always edits a saved dump: text autosaves, recordings are stored as soon as they
 * stop, and closing keeps everything in the Inbox. Organizing into tasks is optional.
 */
function Editor({ initialId, onClose }: { initialId: string | null; onClose: () => void }) {
  const [id, setId] = useState<string | null>(initialId);
  const idRef = useRef<string | null>(initialId);
  const dump = useDump(id);
  const [text, setText] = useState('');
  const loaded = useRef(false);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [busy, setBusy] = useState(false);
  const tags = useTags();
  const ref = useRef<HTMLTextAreaElement>(null);
  const held = useRef(0);
  const wasListening = useRef(false);
  const autoListen = useUi((s) => s.autoListen);
  const textRef = useRef('');
  const desktop = useIsDesktop();
  const voiceLang = useSettings((s) => s.voiceLang);

  const creating = useRef<Promise<string> | null>(null);
  const recorded = useRef(false);
  /** Creates the dump record the first time there is something to keep (once, even if asked twice at once). */
  function ensureId(): Promise<string> {
    if (idRef.current) return Promise.resolve(idRef.current);
    creating.current ??= createDump(textRef.current).then((d) => {
      idRef.current = d.id;
      setId(d.id);
      return d.id;
    });
    return creating.current;
  }

  const voice = useVoice({
    onFinal: (t) =>
      setText((cur) => {
        const next = appendText(cur, t);
        textRef.current = next;
        return next;
      }),
    onAudio: (blob) => {
      recorded.current = true;
      void ensureId().then((dumpId) => addClip(dumpId, blob));
    },
    lang: voiceLang,
  });
  const startVoice = voice.start;
  const listeningRef = useRef(false);
  listeningRef.current = voice.state === 'listening';

  // load existing text once
  useEffect(() => {
    if (loaded.current || !dump) return;
    loaded.current = true;
    textRef.current = dump.text;
     
    setText((cur) => cur || dump.text);
  }, [dump]);
  useEffect(() => {
    if (!initialId) loaded.current = true;
    // phones open without the keyboard, so the choice between writing and the mic stays in view
    if (window.matchMedia('(min-width: 1024px)').matches) ref.current?.focus({ preventScroll: true }); // no scroll chasing the field while the sheet opens
  }, [initialId]);

  useEffect(() => {
    if (autoListen) {
      useUi.getState().set({ autoListen: false });
      void startVoice();
    }
  }, [autoListen, startVoice]);

  // opened via an Inbox card's Organize button: go straight to review once the text is loaded
  const pendingOrganize = useRef(useUi.getState().autoOrganize);
  useEffect(() => {
    if (!pendingOrganize.current || !text.trim()) return;
    pendingOrganize.current = false;
    useUi.getState().set({ autoOrganize: false });
    void run();
    // run is recreated each render; this must fire once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // debounced autosave: nothing is created until there is text
  useEffect(() => {
    textRef.current = text;
    if (!loaded.current) return;
    if (!idRef.current && !text.trim()) return;
    const t = setTimeout(() => {
      void ensureId().then((dumpId) => updateDumpText(dumpId, textRef.current));
    }, 300);
    return () => clearTimeout(t);
    // ensureId only reads refs and stable setters
     
  }, [text]);

  // closing in any way (Done, backdrop, Escape) keeps the dump: flush text, drop it only if empty
  useEffect(
    () => () => {
      if (!loaded.current) return;
      const t = textRef.current;
      if (!idRef.current) {
        if (t.trim() || creating.current) void ensureId().then((dumpId) => updateDumpText(dumpId, t));
        return;
      }
      const dumpId = idRef.current;
      void updateDumpText(dumpId, t).then(() => !listeningRef.current && discardIfEmpty(dumpId));
    },
    [],
  );

  async function flush(): Promise<string | null> {
    if (!idRef.current && !textRef.current.trim()) return null;
    const dumpId = await ensureId();
    await updateDumpText(dumpId, textRef.current);
    return dumpId;
  }

  async function finish() {
    await voice.stop(); // the last words and the audio land before saving
    const dumpId = await flush();
    if (dumpId && (textRef.current.trim() || recorded.current || (dump?.audioIds.length ?? 0) > 0)) useToast.getState().show('Saved to Inbox');
    onClose();
  }

  async function run() {
    if (!text.trim()) return;
    setBusy(true);
    await flush();
    // AI organizing is parked (no API keys); the on-device splitter always runs
    const { tasks } = await organize(text, tags, false);
    setBusy(false);
    setCards(tasks.map((t) => ({ ...t, included: true })));
  }

  const patch = (i: number, p: Partial<Card>) =>
    setCards((cs) => cs?.map((c, n) => (n === i ? { ...c, ...p } : c)) ?? null);
  const merge = (i: number) =>
    setCards((cs) => {
      if (!cs || i === 0) return cs;
      const next = [...cs];
      next[i - 1] = { ...next[i - 1], title: `${next[i - 1].title} ${next[i].title}`.trim() };
      next.splice(i, 1);
      return next;
    });
  const asSubtask = (i: number) =>
    setCards((cs) => {
      if (!cs || i === 0) return cs;
      const next = [...cs];
      next[i - 1] = { ...next[i - 1], subtasks: [...next[i - 1].subtasks, next[i].title] };
      next.splice(i, 1);
      return next;
    });

  if (cards) {
    const chosen = cards.filter((c) => c.included && c.title.trim());
    return (
      <div className={styles.body}>
        <p className={styles.hint}>
          {cards.length === 0 ? 'No tasks found' : `${cards.length} tasks found — review before adding`}
        </p>
        <ul className={styles.cards}>
          {cards.map((c, i) => (
            <li key={c.id} className={`${styles.card} ${c.included ? '' : styles.off}`}>
              <input
                type="checkbox"
                aria-label={`Include ${c.title}`}
                checked={c.included}
                onChange={(e) => patch(i, { included: e.target.checked })}
              />
              <div className={styles.cardBody}>
                <input className={styles.cardTitle} value={c.title} aria-label="Task title" onChange={(e) => patch(i, { title: e.target.value })} />
                {metaOf(c) && <span className={styles.meta}>{metaOf(c)}</span>}
              </div>
              {i > 0 && (
                <>
                  <button type="button" aria-label="Merge into previous" onClick={() => merge(i)}>
                    <ArrowUp size={20} strokeWidth={1.5} />
                  </button>
                  <button type="button" aria-label="Make subtask of previous" onClick={() => asSubtask(i)}>
                    <CornerDownRight size={20} strokeWidth={1.5} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Button onClick={() => setCards(null)}>Back</Button>
          <Button
            variant="primary"
            disabled={chosen.length === 0}
            onClick={async () => {
              const dumpId = await flush();
              if (dumpId) await organizeDump(dumpId, chosen);
              onClose();
              toastWithUndo(`${chosen.length} tasks added`);
            }}
          >
            Add {chosen.length} {chosen.length === 1 ? 'task' : 'tasks'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.body}>
      <textarea
        ref={ref}
        className={styles.area}
        value={text}
        placeholder={
          desktop ? 'Write or say everything on your mind. Sort it out later.' : 'Tap to write, or use the mic. Sort it out later.'
        }
        aria-label="Brain dump"
        onChange={(e) => setText(e.target.value)}
      />
      {dump && dump.audioIds.length > 0 && (
        <div className={styles.clips} aria-label="Recordings">
          {dump.audioIds.map((a, n) => (
            <ClipPlayer
              key={a}
              audioId={a}
              label={`Recording ${n + 1}`}
              onRemove={() => void removeClip(dump.id, a)}
            />
          ))}
        </div>
      )}
      {voice.state === 'listening' && (
        <p className={styles.rec} role="status">
          <span className={styles.wave} aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </span>
          <Elapsed since={voice.startedAt} />
          <span className={styles.live}>{voice.interim || 'Listening…'}</span>
        </p>
      )}
      {voice.notice && <p className={styles.hint}>{voice.notice}</p>}
      {voice.error && (
        <p className={styles.hint} role="alert">
          {voice.error}
        </p>
      )}
      <div className={`${styles.actions} ${desktop ? '' : styles.thumb}`}>
        {voice.supported && (
          <button
            type="button"
            className={`${styles.mic} ${voice.state === 'listening' ? styles.on : ''}`}
            aria-label={voice.state === 'listening' ? 'Stop recording' : 'Record voice'}
            aria-pressed={voice.state === 'listening'}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              wasListening.current = voice.state === 'listening';
              held.current = Date.now();
              if (voice.state === 'idle') {
                if (!desktop) ref.current?.blur(); // drop the keyboard so the recording is in view
                void voice.start();
              }
            }}
            onPointerUp={() => {
              // hold-to-talk: releasing a clear hold stops; a tap (even a slow one) keeps recording
              if (!wasListening.current && Date.now() - held.current > 600 && voice.state === 'listening') void voice.stop();
            }}
            onClick={(e) => {
              // detail 0 = keyboard activation (toggle); otherwise a tap on an already-running recording stops it
              if (e.detail === 0) {
                if (voice.state === 'listening') void voice.stop();
                else void voice.start();
              } else if (wasListening.current) void voice.stop();
            }}
          >
            <Mic size={desktop ? 20 : 28} strokeWidth={1.5} />
          </button>
        )}
        <Button disabled={!text.trim() || busy} onClick={() => void run()}>
          {busy ? 'Organizing…' : 'Organize now'}
        </Button>
        <Button variant="primary" onClick={() => void finish()}>
          Done
        </Button>
      </div>
    </div>
  );
}

export function BrainDump() {
  const open = useUi((s) => s.brainDump);
  const dumpId = useUi((s) => s.dumpId);
  const set = useUi((s) => s.set);
  const close = () => set({ brainDump: false, dumpId: null });
  return (
    <Sheet open={open} onClose={close} title="Brain dump" full>
      {open && <Editor key={dumpId ?? 'new'} initialId={dumpId} onClose={close} />}
    </Sheet>
  );
}
