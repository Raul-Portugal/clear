import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'quiet';
}

export function Button({ variant = 'quiet', className, ...rest }: Props) {
  return <button className={`${styles.btn} ${styles[variant]} ${className ?? ''}`} {...rest} />;
}
