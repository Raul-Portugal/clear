import { describe, expect, it } from 'vitest';
import { planReorder, type Ordered } from './reorderList';

const apply = (seq: Ordered[], changes: Ordered[]) =>
  seq
    .map((x) => changes.find((c) => c.id === x.id) ?? x)
    .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    .map((x) => x.id);

describe('planReorder', () => {
  const sorted: Ordered[] = [
    { id: 'a', order: 'a0' },
    { id: 'b', order: 'a1' },
    { id: 'c', order: 'a2' },
    { id: 'd', order: 'a3' },
  ];

  it('does nothing for a no-op or out-of-range move', () => {
    expect(planReorder(sorted, 1, 1)).toEqual([]);
    expect(planReorder(sorted, 0, 9)).toEqual([]);
  });

  it('re-keys only the moved item when the list is in key order', () => {
    const down = planReorder(sorted, 0, 2);
    expect(down).toHaveLength(1);
    expect(apply(sorted, down)).toEqual(['b', 'c', 'a', 'd']);
    expect(apply(sorted, planReorder(sorted, 3, 0))).toEqual(['d', 'a', 'b', 'c']);
    expect(apply(sorted, planReorder(sorted, 1, 3))).toEqual(['a', 'c', 'd', 'b']);
  });

  it('re-keys the whole sequence when the displayed order is not key order', () => {
    const shown: Ordered[] = [
      { id: 'c', order: 'a2' },
      { id: 'a', order: 'a0' },
      { id: 'b', order: 'a1' },
    ];
    expect(apply(shown, planReorder(shown, 2, 0))).toEqual(['b', 'c', 'a']);
  });
});
