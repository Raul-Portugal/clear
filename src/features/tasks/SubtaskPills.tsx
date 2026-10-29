import type { CSSProperties } from 'react';
import { Bars } from '../../ui/Bars';
import { formatDue, isOverdue } from '../../domain/dates';
import type { Subtask } from '../../domain/types';
import { tagColor, useTags } from '../filters/useTags';
import { effortOf, urgencyOf } from './levels';
import styles from './SubtaskPills.module.css';

/** The same quiet categorization read-out tasks get: due, tags, then urgency and effort pills. */
export function SubtaskPills({ s }: { s: Subtask }) {
  const tags = useTags();
  const own = tags.filter((t) => s.tagIds?.includes(t.id));
  const urg = s.urgency ? urgencyOf(s.urgency) : undefined;
  const eff = s.effort ? effortOf(s.effort) : undefined;
  if (!s.due && own.length === 0 && !urg && !eff) return null;
  const now = new Date();
  return (
    <span className={styles.line}>
      {s.due && (
        <span className={!s.done && isOverdue(s.due, now) ? styles.overdue : styles.muted}>{formatDue(s.due, now)}</span>
      )}
      {own.map((t) => (
        <span key={t.id} style={{ color: tagColor(t.color) }}>
          #{t.name}
        </span>
      ))}
      {urg && (
        <span
          className={styles.badge}
          role="img"
          aria-label={`${urg.label} urgency`}
          style={{ '--c': urg.color, '--c-soft': urg.soft } as CSSProperties}
        >
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
          {eff.short}
        </span>
      )}
    </span>
  );
}
