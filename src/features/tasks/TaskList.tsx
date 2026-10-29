import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, Reorder } from 'motion/react';
import type { Task } from '../../domain/types';
import { useTags } from '../filters/useTags';
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
  const [lifted, setLifted] = useState<string | null>(null);
  const latest = useRef<string[] | null>(null);
  const tags = useTags();
  // callbacks read the latest props through a ref so their identity never changes (keeps TaskRow memoized)
  const live = useRef({ tasks, onMove });
  useEffect(() => {
    live.current = { tasks, onMove };
  });
  const onLift = useCallback((id: string) => {
    latest.current = null;
    setLifted(id);
  }, []);
  const onDrop = useCallback((taskId: string) => {
    const { tasks: ts, onMove: move } = live.current;
    const to = latest.current?.indexOf(taskId) ?? -1;
    const from = ts.findIndex((x) => x.id === taskId);
    if (to >= 0 && to !== from) move?.(taskId, to);
    latest.current = null;
    setLifted(null);
  }, []);
  // the dropped order stays on screen until the saved order arrives (i.e. `tasks` changes)
  const shown = tasks.map((t) => t.id).join(',');
  const [dragFor, setDragFor] = useState('');

  if (tasks.length === 0) return <p className={styles.empty}>{empty}</p>;

  const ids = dragIds && dragFor === shown ? dragIds : tasks.map((t) => t.id);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  return (
    <Reorder.Group
      as="ul"
      axis="y"
      values={ids}
      onReorder={(next) => {
        latest.current = next;
        setDragIds(next);
        setDragFor(shown);
      }}
      className={styles.list}
    >
      <AnimatePresence initial={false}>
        {ids.map((id) => {
          const t = byId.get(id);
          return (
            t && (
              <TaskRow key={id} task={t} tags={tags} dragging={lifted === id} onLift={onMove ? onLift : undefined} onDrop={onMove ? onDrop : undefined} />
            )
          );
        })}
      </AnimatePresence>
    </Reorder.Group>
  );
}
