import { describe, expect, it } from 'vitest';
import { mergeTag, mergeTask } from './merge';
import type { Tag, Task } from './types';

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'a',
  status: 'open',
  urgency: 0,
  tagIds: [],
  subtasks: [],
  order: 'a',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const tag = (name: string, updatedAt?: number): Tag => ({ id: 'g', name, color: 'x', order: 'a', updatedAt });

describe('mergeTask', () => {
  it('handles missing sides', () => {
    expect(mergeTask(undefined, undefined)).toBeUndefined();
    const t = task();
    expect(mergeTask(t, undefined)).toBe(t);
    expect(mergeTask(undefined, t)).toBe(t);
  });
  it('newer wins', () => {
    const a = task({ title: 'local', updatedAt: 5 });
    const b = task({ title: 'remote', updatedAt: 3 });
    expect(mergeTask(a, b)).toBe(a);
    expect(mergeTask(b, a)).toBe(a);
  });
  it('tie goes to remote', () => {
    const a = task({ title: 'local', updatedAt: 5 });
    const b = task({ title: 'remote', updatedAt: 5 });
    expect(mergeTask(a, b)).toBe(b);
  });
  it('tombstones win or lose by updatedAt', () => {
    const live = task({ updatedAt: 4 });
    const dead = task({ updatedAt: 6, deletedAt: 6 });
    expect(mergeTask(live, dead)).toBe(dead);
    const restored = task({ updatedAt: 9 });
    expect(mergeTask(dead, restored)).toBe(restored);
  });
});

describe('mergeTag', () => {
  it('lww with remote on tie', () => {
    expect(mergeTag(tag('l', 2), tag('r', 1))?.name).toBe('l');
    expect(mergeTag(tag('l', 2), tag('r', 2))?.name).toBe('r');
    expect(mergeTag(undefined, tag('r', 1))?.name).toBe('r');
    expect(mergeTag(tag('l'), tag('r', 1))?.name).toBe('r');
    expect(mergeTag(tag('l'), tag('r', 1))?.name).toBe('r');
  });
});
