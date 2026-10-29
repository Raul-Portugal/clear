import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

export interface Ordered {
  id: string;
  order: string;
}

/**
 * New order keys after moving the item at `from` to `to` in a displayed sequence.
 * When the sequence is already in key order, only the moved item gets a new key;
 * otherwise (e.g. the list was smart-sorted) the whole sequence is re-keyed so the
 * manual order matches what the user sees.
 */
export function planReorder(seq: Ordered[], from: number, to: number): Ordered[] {
  if (from === to || from < 0 || to < 0 || from >= seq.length || to >= seq.length) return [];
  const next = [...seq];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  const inKeyOrder = seq.every((x, i) => i === 0 || seq[i - 1].order < x.order);
  if (inKeyOrder) {
    const before = next[to - 1]?.order ?? null;
    const after = next[to + 1]?.order ?? null;
    return [{ id: moved.id, order: generateKeyBetween(before, after) }];
  }
  const keys = generateNKeysBetween(null, null, next.length);
  return next.map((x, i) => ({ id: x.id, order: keys[i] })).filter((x, i) => x.order !== next[i].order);
}
