import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { useIsDesktop } from '../hooks/useMediaQuery';
import styles from './Sheet.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Desktop only: right side panel instead of a centered modal. */
  side?: boolean;
  /** Mobile only: a full-screen page instead of a bottom sheet (for writing, where the keyboard is up). */
  full?: boolean;
}

/** Mobile: bottom sheet with drag-to-dismiss. Desktop: right panel (side) or centered modal. */
export function Sheet({ open, onClose, title, children, side, full }: Props) {
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const hidden = reduced
    ? { opacity: 0 }
    : desktop
      ? side
        ? { x: 40, opacity: 0 }
        : { y: 12, opacity: 0 }
      : full
        ? { y: 16, opacity: 0 }
        : { y: '100%' };
  const shown = reduced ? { opacity: 1 } : { x: 0, y: 0, opacity: 1 };
  const cls = desktop ? (side ? styles.side : styles.modal) : full ? styles.full : styles.bottom;
  const dismissDrag = !desktop && !full && !reduced;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className={styles.scrim}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cls}
            initial={hidden}
            animate={shown}
            exit={hidden}
            transition={full && !desktop ? { duration: 0.2, ease: 'easeOut' } : { type: 'spring', damping: 30, stiffness: 320 }}
            drag={dismissDrag ? 'y' : false}
            dragControls={controls}
            dragListener={false}
            onPointerDown={(e) => {
              // drag to dismiss from anywhere except controls, so inputs and inner drags keep working
              const el = e.target as HTMLElement;
              if (dismissDrag && !el.closest('input, textarea, button, select, label, li')) controls.start(e);
            }}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
          >
            {dismissDrag && <div className={styles.grab} aria-hidden />}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
