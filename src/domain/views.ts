import { toISODate, diffDays, fromISODate } from './dates';
import type { Task } from './types';

export type ViewId = 'now' | 'upcoming' | 'waiting' | 'done' | 'inbox';

export interface TaskGroup {
  key: string;
  heading?: string;
  tasks: Task[];
}

/** A waiting task whose follow-up date has arrived resurfaces in Now. */
export function isFollowUpDue(t: Task, now: Date): boolean {
  return t.status === 'waiting' && !!t.waiting?.followUp && t.waiting.followUp <= toISODate(now);
}

export function selectView(view: ViewId, tasks: Task[], now: Date): Task[] {
  switch (view) {
    case 'now':
      return tasks.filter((t) => t.status === 'open' || isFollowUpDue(t, now));
    case 'upcoming':
      return tasks.filter((t) => t.status === 'open' && t.due);
    case 'waiting':
      return tasks.filter((t) => t.status === 'waiting' && !isFollowUpDue(t, now));
    case 'inbox':
      return []; // brain dumps are not tasks; the Inbox view renders them itself
    case 'done':
      return tasks.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  }
}

export function filterByTags(tasks: Task[], tagIds: string[]): Task[] {
  if (tagIds.length === 0) return tasks;
  return tasks.filter((t) => tagIds.some((id) => t.tagIds.includes(id)));
}

/** Case-insensitive search over title, notes and subtask titles. */
export function searchTasks(tasks: Task[], query: string): Task[] {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      (t.notes ?? '').toLowerCase().includes(q) ||
      t.subtasks.some((s) => s.title.toLowerCase().includes(q)),
  );
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayHeading(iso: string, now: Date): string {
  const delta = diffDays(iso, toISODate(now));
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  const d = fromISODate(iso);
  return delta > 1 && delta < 7 ? DAYS[d.getDay()] : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Groups tasks by a date key (tasks are kept in the given order within a group). */
export function groupByDay(tasks: Task[], dateOf: (t: Task) => string | undefined, now: Date): TaskGroup[] {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    const k = dateOf(t) ?? '';
    map.set(k, [...(map.get(k) ?? []), t]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([k, ts]) => ({ key: k || 'none', heading: k ? dayHeading(k, now) : 'No date', tasks: ts }));
}

/** Now view: overdue + due-today tasks first under one quiet heading, the rest after. */
export function groupNow(tasks: Task[], now: Date): TaskGroup[] {
  const today = toISODate(now);
  const due = tasks.filter((t) => (t.due && t.due.date <= today) || isFollowUpDue(t, now));
  const rest = tasks.filter((t) => !due.includes(t));
  const groups: TaskGroup[] = [];
  if (due.length) groups.push({ key: 'due', heading: 'Today', tasks: due });
  if (rest.length) groups.push({ key: 'rest', heading: due.length ? 'Later' : undefined, tasks: rest });
  return groups;
}
