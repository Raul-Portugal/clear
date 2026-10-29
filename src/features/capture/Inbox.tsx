import { Mic, NotebookPen, Trash2 } from 'lucide-react';
import { deleteDump } from '../../data/dumps';
import type { Dump } from '../../domain/types';
import { toastWithUndo, useUi } from '../tasks/actions';
import { ClipPlayer } from './ClipPlayer';
import { useDumps } from './useDumps';
import styles from './Inbox.module.css';

function when(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${time}`;
}

function DumpCard({ dump }: { dump: Dump }) {
  const set = useUi((s) => s.set);
  const preview = dump.text.trim();
  const open = (organize: boolean) => set({ brainDump: true, dumpId: dump.id, autoOrganize: organize });
  return (
    <li className={styles.card} data-dump-id={dump.id}>
      <button type="button" className={styles.body} aria-label={`Open brain dump from ${when(dump.createdAt)}`} onClick={() => open(false)}>
        <span className={`${styles.text} ${preview ? '' : styles.faint}`}>{preview || 'Voice note, no transcript'}</span>
        <span className={styles.meta}>
          {when(dump.createdAt)}
          {dump.audioIds.length > 0 && (
            <span className={styles.mic}>
              <Mic size={12} strokeWidth={1.75} aria-hidden /> {dump.audioIds.length}
            </span>
          )}
        </span>
      </button>
      {dump.audioIds.length > 0 && (
        <div className={styles.clips}>
          {dump.audioIds.map((a, n) => (
            <ClipPlayer key={a} audioId={a} label={`Recording ${n + 1}`} />
          ))}
        </div>
      )}
      <div className={styles.actions}>
        {preview && (
          <button type="button" className={styles.organize} onClick={() => open(true)}>
            Organize
          </button>
        )}
        <button
          type="button"
          className={styles.del}
          aria-label="Delete brain dump"
          onClick={async () => {
            await deleteDump(dump.id);
            toastWithUndo('Brain dump deleted');
          }}
        >
          <Trash2 size={16} strokeWidth={1.75} />
        </button>
      </div>
    </li>
  );
}

export function Inbox() {
  const dumps = useDumps();
  const set = useUi((s) => s.set);
  if (!dumps) return null;
  if (dumps.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Nothing waiting. Dump your thoughts now, sort them out later.</p>
        <button type="button" className={styles.new} onClick={() => set({ brainDump: true, dumpId: null })}>
          <NotebookPen size={18} strokeWidth={1.75} aria-hidden /> New brain dump
        </button>
      </div>
    );
  }
  return (
    <ul className={styles.list}>
      {dumps.map((d) => (
        <DumpCard key={d.id} dump={d} />
      ))}
    </ul>
  );
}
