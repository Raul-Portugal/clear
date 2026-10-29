import type { CSSProperties, ReactNode } from 'react';
import styles from './Chip.module.css';

interface Props {
  children: ReactNode;
  selected?: boolean;
  color?: string;
  onClick?: () => void;
  onRemove?: () => void;
}

export function Chip({ children, selected, color, onClick, onRemove }: Props) {
  const style = color ? ({ '--chip': color } as CSSProperties) : undefined;
  return (
    <span className={`${styles.chip} ${selected ? styles.sel : ''}`} style={style}>
      <button type="button" className={styles.main} onClick={onClick} aria-pressed={selected}>
        {children}
      </button>
      {onRemove && (
        <button type="button" className={styles.x} onClick={onRemove} aria-label="Remove">
          ×
        </button>
      )}
    </span>
  );
}
