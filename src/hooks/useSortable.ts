import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MotionValue } from 'motion/react';

interface Item {
  el: HTMLElement;
  y: MotionValue<number>;
}

interface Drag {
  id: string;
  order: string[];
  from: number;
  to: number;
  mids: number[];
  heights: number[];
  gap: number;
  offsets: number[];
  startY: number;
  lastY: number;
  scroller: HTMLElement;
  scroll0: number;
  touch: boolean;
  moved: boolean;
  raf: number;
  listeners: AbortController;
  onEnd?: (moved: boolean) => void;
}

interface Options {
  /** The ids in the order they are on screen. */
  ids: string[];
  /** Called after the lifted row settles; `to` is its new index (the old one when dropped in place). */
  onDrop: (id: string, to: number) => void;
}

export interface Sortable {
  /** A row hands over its element and the y offset it renders with; returns the cleanup. */
  register: (id: string, el: HTMLElement, y: MotionValue<number>) => () => void;
  /** Lifts a row at the pointer's y. `onEnd` gets whether it moved at all (a hold-release does not). */
  start: (id: string, clientY: number, touch: boolean, onEnd?: (moved: boolean) => void) => void;
}

const DURATION = 150;
const EDGE = 72; // auto-scroll zone at the top and bottom of the scroller
const MAX_SPEED = 16;

function scrollParent(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

const tweens = new WeakMap<MotionValue<number>, number>();

/**
 * Eases a value to `to` on our own frame loop. (motion's `animate()` on these values could
 * report completion before running and then land after the offsets were reset.)
 */
function tween(y: MotionValue<number>, to: number, onDone?: () => void) {
  cancelAnimationFrame(tweens.get(y) ?? 0);
  const from = y.get();
  const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : DURATION;
  const t0 = performance.now();
  const step = (now: number) => {
    const p = ms ? Math.min(1, (now - t0) / ms) : 1;
    y.set(from + (to - from) * (1 - (1 - p) ** 3));
    if (p < 1) tweens.set(y, requestAnimationFrame(step));
    else {
      tweens.delete(y);
      onDone?.();
    }
  };
  tweens.set(y, requestAnimationFrame(step));
}

function stopTween(y: MotionValue<number>) {
  cancelAnimationFrame(tweens.get(y) ?? 0);
  tweens.delete(y);
}

/**
 * Drag-to-reorder without moving DOM nodes mid-drag: the lifted row follows the pointer
 * frame by frame, its neighbours slide out of the way, and the order changes once, on drop.
 * Touch is tracked with touch events (not pointer events) so a long-press lift survives the
 * browser's scroll / selection takeover, and page scroll is blocked while a row is lifted.
 */
export function useSortable({ ids, onDrop }: Options) {
  const items = useRef(new Map<string, Item>());
  const drag = useRef<Drag | null>(null);
  const settling = useRef(false);
  const [active, setActive] = useState<string | null>(null);
  const live = useRef({ ids, onDrop });
  useEffect(() => {
    live.current = { ids, onDrop };
  });

  const resetAll = useCallback(() => {
    for (const it of items.current.values()) {
      stopTween(it.y);
      it.y.jump(0);
      it.el.style.transform = ''; // now, not on motion's next frame: the new order is already painted
    }
  }, []);

  // The dropped order just rendered: clear the offsets in the same frame so nothing jumps.
  const key = ids.join(',');
  useLayoutEffect(() => {
    if (!settling.current) return;
    settling.current = false;
    resetAll();
  }, [key, resetAll]);

  const update = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    const dy = d.lastY - d.startY + d.scroller.scrollTop - d.scroll0;
    if (Math.abs(dy) > 4) d.moved = true;
    items.current.get(d.id)?.y.set(Math.round(dy)); // whole pixels keep the lifted text crisp
    const center = d.mids[d.from] + dy;
    let to = d.from;
    for (let i = d.from + 1; i < d.order.length; i++) if (center > d.mids[i]) to = i;
    for (let i = d.from - 1; i >= 0; i--) if (center < d.mids[i]) to = i;
    if (to === d.to) return;
    d.to = to;
    const size = d.heights[d.from] + d.gap;
    d.order.forEach((id, i) => {
      if (i === d.from) return;
      const off = i > d.from && i <= to ? -size : i < d.from && i >= to ? size : 0;
      if (off === d.offsets[i]) return;
      d.offsets[i] = off;
      const y = items.current.get(id)?.y;
      if (y) tween(y, off);
    });
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drag.current || drag.current.touch) return;
      drag.current.lastY = e.clientY;
      update();
    },
    [update],
  );

  const end = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    cancelAnimationFrame(d.raf);
    d.listeners.abort();
    setActive(null);
    let final = 0;
    for (let i = d.from + 1; i <= d.to; i++) final += d.heights[i] + d.gap;
    for (let i = d.to; i < d.from; i++) final -= d.heights[i] + d.gap;
    const it = items.current.get(d.id);
    const done = () => {
      d.onEnd?.(d.moved);
      if (d.to === d.from) return;
      settling.current = true;
      live.current.onDrop(d.id, d.to);
      // safety net if the owner did not re-render with a new order
      setTimeout(() => {
        if (!settling.current) return;
        settling.current = false;
        resetAll();
      }, 400);
    };
    if (it) tween(it.y, final, done);
    else done();
  }, [resetAll]);

  const start = useCallback<Sortable['start']>(
    (id, clientY, touch, onEnd) => {
      if (drag.current || settling.current) return;
      const order = live.current.ids;
      const from = order.indexOf(id);
      const els = order.map((k) => items.current.get(k)?.el);
      if (from < 0 || els.some((el) => !el)) return;
      const rects = (els as HTMLElement[]).map((el) => el.getBoundingClientRect());
      const scroller = scrollParent(els[from] as HTMLElement);
      const d: Drag = {
        id,
        order,
        from,
        to: from,
        mids: rects.map((r) => r.top + r.height / 2),
        heights: rects.map((r) => r.height),
        gap: rects.length > 1 ? rects[1].top - rects[0].bottom : 0,
        offsets: order.map(() => 0),
        startY: clientY,
        lastY: clientY,
        scroller,
        scroll0: scroller.scrollTop,
        touch,
        moved: false,
        raf: 0,
        listeners: new AbortController(),
        onEnd,
      };
      drag.current = d;
      setActive(id);
      if (!touch) {
        const { signal } = d.listeners;
        window.addEventListener('pointermove', onPointerMove, { signal });
        window.addEventListener('pointerup', end, { signal });
        window.addEventListener('pointercancel', end, { signal });
      }
      // auto-scroll while the pointer rests near the scroller's top or bottom edge
      const tick = () => {
        if (drag.current !== d) return;
        const isDoc = scroller === document.scrollingElement || scroller === document.documentElement;
        const r = isDoc ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
        const near = d.lastY < r.top + EDGE ? d.lastY - r.top - EDGE : d.lastY > r.bottom - EDGE ? d.lastY - r.bottom + EDGE : 0;
        if (near) {
          scroller.scrollTop += Math.max(-MAX_SPEED, Math.min(MAX_SPEED, Math.round((near / EDGE) * MAX_SPEED)));
          update();
        }
        d.raf = requestAnimationFrame(tick);
      };
      d.raf = requestAnimationFrame(tick);
    },
    [end, onPointerMove, update],
  );

  // Touch tracking lives on the list element with a non-passive listener registered up front:
  // iOS only honours preventDefault from listeners that existed when the touch began.
  const listRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      const move = (e: TouchEvent) => {
        const d = drag.current;
        if (!d?.touch) return;
        e.preventDefault();
        d.lastY = e.touches[0].clientY;
        update();
      };
      const up = (e: TouchEvent) => {
        if (!drag.current?.touch) return;
        e.preventDefault(); // no synthetic click on release
        e.stopPropagation(); // and no pull-to-search from the view
        end();
      };
      el.addEventListener('touchmove', move, { passive: false });
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up);
      return () => {
        el.removeEventListener('touchmove', move);
        el.removeEventListener('touchend', up);
        el.removeEventListener('touchcancel', up);
      };
    },
    [end, update],
  );

  const register = useCallback<Sortable['register']>((id, el, y) => {
    items.current.set(id, { el, y });
    return () => {
      if (items.current.get(id)?.el === el) items.current.delete(id);
    };
  }, []);

  const sortable = useMemo<Sortable>(() => ({ register, start }), [register, start]);
  return { listRef, active, sortable };
}
