import { diffDays, isOverdue, toISODate } from './dates';
import type { Effort, Task } from './types';

export type SortMode = 'smart' | 'urgency' | 'effort' | 'due' | 'manual';
export type SmartGroup = 'overdue' | 'today' | 'urgent' | 'soon' | 'rest';

const GROUP_RANK: Record<SmartGroup, number> = { overdue: 0, today: 1, urgent: 2, soon: 3, rest: 4 };
const EFFORT_RANK: Record<Effort, number> = { quick: 0, medium: 1, deep: 2 };
const SOON_DAYS = 7;

type Cmp = (a: Task, b: Task) => number;

const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const cmpOrder: Cmp = (a, b) => cmpStr(a.order, b.order);

/** Due date+time ascending; undated last. */
const cmpDue: Cmp = (a, b) => {
  if (!a.due && !b.due) return 0;
  if (!a.due) return 1;
  if (!b.due) return -1;
  return cmpStr(a.due.date, b.due.date) || cmpStr(a.due.time ?? '', b.due.time ?? '');
};

const cmpUrgencyDesc: Cmp = (a, b) => b.urgency - a.urgency;

const effortRank = (t: Task): number => (t.effort ? EFFORT_RANK[t.effort] : 3);
const cmpEffort: Cmp = (a, b) => effortRank(a) - effortRank(b);

export function smartGroup(task: Task, now: Date): SmartGroup {
  if (isOverdue(task.due, now)) return 'overdue';
  const today = toISODate(now);
  if (task.due && task.due.date === today) return 'today';
  if (task.urgency === 3) return 'urgent';
  if (task.due) {
    const delta = diffDays(task.due.date, today);
    if (delta >= 1 && delta <= SOON_DAYS) return 'soon';
  }
  return 'rest';
}

function chain(...cmps: Cmp[]): Cmp {
  return (a, b) => {
    for (const c of cmps) {
      const r = c(a, b);
      if (r !== 0) return r;
    }
    return 0;
  };
}

export function sortTasks(
  tasks: Task[],
  mode: SortMode,
  now: Date,
  opts: { reverseEffort?: boolean } = {},
): Task[] {
  const copy = [...tasks];
  switch (mode) {
    case 'smart': {
      const groups = new Map<string, number>(tasks.map((t) => [t.id, GROUP_RANK[smartGroup(t, now)]]));
      const g = (t: Task): number => groups.get(t.id) ?? GROUP_RANK.rest;
      return copy.sort(chain((a, b) => g(a) - g(b), cmpEffort, cmpDue, cmpUrgencyDesc, cmpOrder));
    }
    case 'urgency':
      return copy.sort(chain(cmpUrgencyDesc, cmpDue, cmpOrder));
    case 'effort': {
      const cmp: Cmp = opts.reverseEffort
        ? (a, b) => {
            // Reverse known efforts (deep→quick) but keep unset last.
            const ra = effortRank(a);
            const rb = effortRank(b);
            if (ra === 3 || rb === 3) return ra - rb;
            return rb - ra;
          }
        : cmpEffort;
      return copy.sort(chain(cmp, cmpOrder));
    }
    case 'due':
      return copy.sort(chain(cmpDue, cmpOrder));
    case 'manual':
      return copy.sort(cmpOrder);
  }
}
