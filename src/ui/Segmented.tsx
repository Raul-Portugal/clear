import type { CSSProperties, ReactNode } from 'react';
import styles from './Segmented.module.css';

export interface SegmentOption<T> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Text color and soft background used when selected. */
  color?: string;
  soft?: string;
}

interface Props<T> {
  label: string;
  value: T | undefined;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
}

/** A compact single-choice row of pills (radio group). */
export function Segmented<T extends string | number>({ label, value, options, onChange }: Props<T>) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`${styles.opt} ${value === o.value ? styles.on : ''}`}
          style={{ '--c': o.color ?? 'var(--text)', '--c-soft': o.soft ?? 'var(--surface)' } as CSSProperties}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
