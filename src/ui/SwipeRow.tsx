import { useRef, useState, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useDrag } from '@use-gesture/react';
import { Check, Trash2 } from 'lucide-react';
import { haptic } from '../hooks/useHaptics';
import styles from './SwipeRow.module.css';

const THRESHOLD = 96;
const LONG_PRESS_MS = 420;

interface Props {
  children: ReactNode;
  onComplete: () => void;
  onDelete: () => void;
  /** Fired after holding still, with where the pointer is now, so a drag can take over. */
  onLongPress: (at: { y: number; touch: boolean }) => void;
  /** While true (e.g. the row is being dragged to reorder), horizontal swipes are ignored. */
  locked?: boolean;
}

/** Swipe right = complete, swipe left = delete. Hold = lift (reorder or open). */
export function SwipeRow({ children, onComplete, onDelete, onLongPress, locked }: Props) {
  const x = useMotionValue(0);
  const [armed, setArmed] = useState<'none' | 'complete' | 'delete'>('none');
  const press = useRef<ReturnType<typeof setTimeout>>(undefined);
  // touch long-press runs on touch events: pointer events get cancelled when the browser
  // starts a scroll or a text selection, which is exactly what a long-press can trigger
  const touch = useRef<{ x: number; y: number; lastY: number } | null>(null);

  const leftOpacity = useTransform(x, [0, 24, THRESHOLD], [0, 0.6, 1]);
  const rightOpacity = useTransform(x, [-THRESHOLD, -24, 0], [1, 0.6, 0]);

  const zoneOf = (v: number) => (v > THRESHOLD ? 'complete' : v < -THRESHOLD ? 'delete' : 'none');

  const bind = useDrag(
    ({ first, last, movement: [mx, my], cancel, tap, event }) => {
      const mouse = (event as PointerEvent).pointerType !== 'touch';
      if (first && mouse) {
        const y = (event as PointerEvent).clientY;
        press.current = setTimeout(() => onLongPress({ y, touch: false }), LONG_PRESS_MS);
      }
      if (mouse && (Math.abs(mx) > 8 || Math.abs(my) > 8 || tap)) clearTimeout(press.current);
      if (locked) return;
      if (Math.abs(my) > Math.abs(mx) + 6 && !last) {
        if (mouse) clearTimeout(press.current);
        cancel();
        return;
      }
      x.set(mx);
      const z = zoneOf(mx);
      setArmed((prev) => {
        if (prev !== z && z !== 'none') haptic();
        return z;
      });
      if (last) {
        if (mouse) clearTimeout(press.current);
        setArmed('none');
        if (z === 'none') {
          void animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });
          return;
        }
        // fling the row off in the swipe direction, then hand over to the action
        void animate(x, z === 'complete' ? window.innerWidth : -window.innerWidth, { duration: 0.18 }).then(() => {
          if (z === 'complete') onComplete();
          else onDelete();
          // the row usually leaves the list; if it stays (e.g. undo), bring it back
          setTimeout(() => x.set(0), 600);
        });
      }
    },
    { axis: 'lock', filterTaps: true, pointer: { keys: false } },
  );

  return (
    <div className={styles.wrap}>
      <motion.div className={`${styles.bg} ${styles.done}`} style={{ opacity: leftOpacity }} aria-hidden>
        <motion.span className={styles.label} animate={{ scale: armed === 'complete' ? 1.08 : 1 }}>
          <Check size={20} strokeWidth={2} /> Done
        </motion.span>
      </motion.div>
      <motion.div className={`${styles.bg} ${styles.del}`} style={{ opacity: rightOpacity }} aria-hidden>
        <motion.span className={styles.label} animate={{ scale: armed === 'delete' ? 1.08 : 1 }}>
          Delete <Trash2 size={20} strokeWidth={2} />
        </motion.span>
      </motion.div>
      <div
        {...bind()}
        className={styles.track}
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = { x: t.clientX, y: t.clientY, lastY: t.clientY };
          clearTimeout(press.current);
          if (e.touches.length > 1) return;
          press.current = setTimeout(() => {
            if (!touch.current) return;
            haptic();
            x.set(0);
            onLongPress({ y: touch.current.lastY, touch: true });
          }, LONG_PRESS_MS);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (touch.current && Math.hypot(t.clientX - touch.current.x, t.clientY - touch.current.y) > 10) {
            clearTimeout(press.current);
          }
          if (touch.current) touch.current.lastY = t.clientY;
        }}
        onTouchEnd={() => {
          clearTimeout(press.current);
          touch.current = null;
        }}
        onTouchCancel={() => {
          clearTimeout(press.current);
          touch.current = null;
        }}
        // no long-press callout / context menu on touch: the hold is ours
        onContextMenu={(e) => {
          if (touch.current) e.preventDefault();
        }}
      >
        <motion.div className={styles.fg} style={{ x }}>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
