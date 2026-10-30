import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import type { Task } from '../../domain/types';
import { useTags } from '../filters/useTags';
import { useSortable } from '../../hooks/useSortable';
import { TaskRow } from './TaskRow';
import styles from './TaskList.module.css';

interface Props {
  tasks: Task[];
  empty: string;
  /** Enables drag-to-reorder; called with the task and its new index within this list. */
  onMove?: (id: string, to: number) => void;
}

export function TaskList({ tasks, empty, onMove }: Props) {
  const [dragIds, setDragIds] = useState<string[] | null>(null);
  const tags = useTags();
  // the dropped order stays on screen until the saved order arrives (i.e. `tasks` changes)
  const shown = tasks.map((t) => t.id).join(',');
  const [dragFor, setDragFor] = useState('');
  const ids = dragIds && dragFor === shown ? dragIds : tasks.map((t) => t.id);
  const { listRef, active, sortable } = useSortable({
    ids,
    onDrop: (id, to) => {
      const next = ids.filter((x) => x !== id);
      next.splice(to, 0, id);
      setDragIds(next);
      setDragFor(shown);
      onMove?.(id, to);
    },
  });

  if (tasks.length === 0) return <p className={styles.empty}>{empty}</p>;

  const byId = new Map(tasks.map((t) => [t.id, t]));

  return (
    <ul ref={listRef} className={styles.list}>
      <AnimatePresence initial={false}>
        {ids.map((id) => {
          const t = byId.get(id);
          return (
            t && (
              <TaskRow
                key={id}
                task={t}
                tags={tags}
                dragging={active === id}
                sortable={onMove ? sortable : undefined}
              />
            )
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
