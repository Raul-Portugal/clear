const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-date ISO string `YYYY-MM-DD`. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromISODate(a).getTime() - fromISODate(b).getTime()) / 86_400_000);
}

export interface Due {
  date: string;
  time?: string;
}

/** True when the due date (or date+time) is in the past. */
export function isOverdue(due: Due | undefined, now: Date): boolean {
  if (!due) return false;
  const today = toISODate(now);
  if (due.date < today) return true;
  if (due.date > today) return false;
  return due.time ? due.time < `${pad(now.getHours())}:${pad(now.getMinutes())}` : false;
}

/** Short human label: Today, Tomorrow, Fri, 12 Nov — with optional time. */
export function formatDue(due: Due, now: Date): string {
  const today = toISODate(now);
  const delta = diffDays(due.date, today);
  let label: string;
  if (delta === 0) label = 'Today';
  else if (delta === 1) label = 'Tomorrow';
  else if (delta === -1) label = 'Yesterday';
  else if (delta > 1 && delta < 7) label = DAYS[fromISODate(due.date).getDay()];
  else {
    const d = fromISODate(due.date);
    label = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    if (d.getFullYear() !== now.getFullYear()) label += ` ${d.getFullYear()}`;
  }
  return due.time ? `${label} ${due.time}` : label;
}
