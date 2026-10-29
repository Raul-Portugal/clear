import { Check } from 'lucide-react';
import styles from './Checkbox.module.css';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Checkbox({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={styles.hit}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    >
      <span className={`${styles.box} ${checked ? styles.on : ''}`}>
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
    </button>
  );
}
