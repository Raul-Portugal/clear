import { describe, expect, it } from 'vitest';
import { smartGroup, sortTasks } from './sort';
import type { Effort, Task, Urgency } from './types';

const NOW = new Date(2026, 5, 10, 12, 0); // 2026-06-10 12:00 local

function t(id: string, p: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    status: 'open',
    urgency: 0 as Urgency,
    tagIds: [],
    subtasks: [],
    order: id,
    createdAt: 0,
    updatedAt: 0,
    ...p,
  };
}
const ids = (xs: Task[]) => xs.map((x) => x.id);
const due = (date: string, time?: string) => ({ date, time });

describe('smartGroup', () => {
  it('classifies tasks', () => {
    expect(smartGroup(t('a', { due: due('2026-06-09') }), NOW)).toBe('overdue');
    expect(smartGroup(t('a', { due: due('2026-06-10', '09:00') }), NOW)).toBe('overdue');
    expect(smartGroup(t('a', { due: due('2026-06-10', '18:00') }), NOW)).toBe('today');
    expect(smartGroup(t('a', { due: due('2026-06-10') }), NOW)).toBe('today');
    expect(smartGroup(t('a', { urgency: 3 }), NOW)).toBe('urgent');
    expect(smartGroup(t('a', { urgency: 3, due: due('2026-06-20') }), NOW)).toBe('urgent');
    expect(smartGroup(t('a', { due: due('2026-06-17') }), NOW)).toBe('soon');
    expect(smartGroup(t('a', { due: due('2026-06-18') }), NOW)).toBe('rest');
    expect(smartGroup(t('a'), NOW)).toBe('rest');
  });
});

describe('sortTasks smart', () => {
  it('orders groups overdue > today > urgent > soon > rest', () => {
    const tasks = [
      t('rest'),
      t('soon', { due: due('2026-06-12') }),
      t('urgent', { urgency: 3 }),
      t('today', { due: due('2026-06-10', '20:00') }),
      t('overdue', { due: due('2026-06-01') }),
    ];
    expect(ids(sortTasks(tasks, 'smart', NOW))).toEqual(['overdue', 'today', 'urgent', 'soon', 'rest']);
  });

  it('within a group: effort, then due, then urgency desc, then order', () => {
    const e = (effort?: Effort) => ({ effort });
    const tasks = [
      t('deep', { ...e('deep') }),
      t('unset'),
      t('medium', { ...e('medium') }),
      t('quickLate', { ...e('quick'), due: due('2026-06-30') }),
      t('quickEarly', { ...e('quick'), due: due('2026-06-25') }),
      t('quickNoDue2', { ...e('quick'), urgency: 1, order: 'b' }),
      t('quickNoDue1', { ...e('quick'), urgency: 2, order: 'z' }),
      t('quickTieB', { ...e('quick'), urgency: 2, order: 'b2' }),
    ];
    // all "rest" (no due within 7d, none urgency 3)
    expect(ids(sortTasks(tasks, 'smart', NOW))).toEqual([
      'quickEarly',
      'quickLate',
      'quickTieB', // urgency 2 beats 1; tie with quickNoDue1 broken by order 'b2' < 'z'
      'quickNoDue1',
      'quickNoDue2',
      'medium',
      'deep',
      'unset',
    ]);
  });

  it('falls back to order as final tie-break', () => {
    const tasks = [t('b', { order: 'b' }), t('a', { order: 'a' })];
    expect(ids(sortTasks(tasks, 'smart', NOW))).toEqual(['a', 'b']);
  });
});

describe('sortTasks urgency', () => {
  it('urgency desc, due asc (undated last), then order', () => {
    const tasks = [
      t('u1', { urgency: 1 }),
      t('u3nodue', { urgency: 3 }),
      t('u3late', { urgency: 3, due: due('2026-07-01') }),
      t('u3early', { urgency: 3, due: due('2026-06-20') }),
      t('u3nodueA', { urgency: 3, order: 'a' }),
    ];
    expect(ids(sortTasks(tasks, 'urgency', NOW))).toEqual(['u3early', 'u3late', 'u3nodueA', 'u3nodue', 'u1']);
  });
});

describe('sortTasks effort', () => {
  const tasks = [
    t('none'),
    t('deep', { effort: 'deep' }),
    t('quick2', { effort: 'quick', order: 'z' }),
    t('quick1', { effort: 'quick', order: 'a' }),
    t('medium', { effort: 'medium' }),
  ];
  it('quick to deep, unset last, ties by order', () => {
    expect(ids(sortTasks(tasks, 'effort', NOW))).toEqual(['quick1', 'quick2', 'medium', 'deep', 'none']);
  });
  it('reverseEffort flips known efforts, unset stays last', () => {
    expect(ids(sortTasks(tasks, 'effort', NOW, { reverseEffort: true }))).toEqual([
      'deep',
      'medium',
      'quick1',
      'quick2',
      'none',
    ]);
  });
});

describe('sortTasks due', () => {
  it('date+time asc, undated last, ties by order', () => {
    const tasks = [
      t('none'),
      t('d2', { due: due('2026-06-12') }),
      t('d1late', { due: due('2026-06-11', '15:00') }),
      t('d1early', { due: due('2026-06-11', '08:00') }),
      t('d1tieB', { due: due('2026-06-13'), order: 'b' }),
      t('d1tieA', { due: due('2026-06-13'), order: 'a' }),
    ];
    expect(ids(sortTasks(tasks, 'due', NOW))).toEqual(['d1early', 'd1late', 'd2', 'd1tieA', 'd1tieB', 'none']);
  });
});

describe('sortTasks manual', () => {
  it('uses plain string comparison on order', () => {
    const tasks = [t('x', { order: 'b' }), t('y', { order: 'B' }), t('z', { order: 'a' })];
    // plain < : 'B' (66) < 'a' (97) < 'b' (98); localeCompare would differ
    expect(ids(sortTasks(tasks, 'manual', NOW))).toEqual(['y', 'z', 'x']);
  });
});

describe('non-mutation', () => {
  it('does not mutate the input array', () => {
    const tasks = [t('b', { order: 'b' }), t('a', { order: 'a' })];
    const snapshot = [...tasks];
    for (const m of ['smart', 'urgency', 'effort', 'due', 'manual'] as const) {
      const out = sortTasks(tasks, m, NOW);
      expect(out).not.toBe(tasks);
      expect(tasks).toEqual(snapshot);
    }
  });
});
