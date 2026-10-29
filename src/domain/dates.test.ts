import { formatDue, isOverdue, addDays, toISODate } from './dates';

const now = new Date(2026, 9, 29, 12, 0); // Thu 29 Oct 2026

describe('dates', () => {
  it('formats relative labels', () => {
    expect(formatDue({ date: '2026-10-29' }, now)).toBe('Today');
    expect(formatDue({ date: '2026-10-30', time: '10:00' }, now)).toBe('Tomorrow 10:00');
    expect(formatDue({ date: '2026-11-01' }, now)).toBe('Sun');
    expect(formatDue({ date: '2026-11-12' }, now)).toBe('12 Nov');
    expect(formatDue({ date: '2027-01-03' }, now)).toBe('3 Jan 2027');
  });
  it('detects overdue', () => {
    expect(isOverdue({ date: '2026-10-28' }, now)).toBe(true);
    expect(isOverdue({ date: '2026-10-29' }, now)).toBe(false);
    expect(isOverdue({ date: '2026-10-29', time: '09:00' }, now)).toBe(true);
    expect(isOverdue(undefined, now)).toBe(false);
  });
  it('adds days across months', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(toISODate(now)).toBe('2026-10-29');
  });
});
