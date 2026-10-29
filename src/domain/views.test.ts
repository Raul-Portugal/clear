import type { Task } from './types';
import { filterByTags, groupByDay, groupNow, isFollowUpDue, searchTasks, selectView } from './views';

const now = new Date(2026, 9, 29, 12, 0);
let n = 0;
const mk = (p: Partial<Task>): Task => ({
  id: String(++n), title: 't' + n, status: 'open', urgency: 0, tagIds: [], subtasks: [],
  order: 'a' + n, createdAt: 0, updatedAt: 0, ...p,
});

describe('views', () => {
  it('resurfaces waiting tasks on their follow-up date', () => {
    const w = mk({ status: 'waiting', waiting: { followUp: '2026-10-29' } });
    const w2 = mk({ status: 'waiting', waiting: { followUp: '2026-11-05' } });
    expect(isFollowUpDue(w, now)).toBe(true);
    expect(selectView('now', [w, w2], now)).toEqual([w]);
    expect(selectView('waiting', [w, w2], now)).toEqual([w2]);
  });

  it('upcoming needs a due date', () => {
    const a = mk({ due: { date: '2026-11-01' } });
    const b = mk({});
    expect(selectView('upcoming', [a, b], now)).toEqual([a]);
  });

  it('filters by any selected tag', () => {
    const a = mk({ tagIds: ['x'] });
    const b = mk({ tagIds: ['y'] });
    expect(filterByTags([a, b], ['x'])).toEqual([a]);
    expect(filterByTags([a, b], [])).toEqual([a, b]);
  });

  it('searches titles, notes and subtasks', () => {
    const a = mk({ title: 'Dentist' });
    const b = mk({ notes: 'call DENTIST' });
    const c = mk({ subtasks: [{ id: 's', title: 'dentist form', done: false }] });
    const d = mk({ title: 'other' });
    expect(searchTasks([a, b, c, d], 'dentist')).toEqual([a, b, c]);
  });

  it('groups upcoming by day, undated last', () => {
    const a = mk({ due: { date: '2026-10-30' } });
    const b = mk({ due: { date: '2026-10-29' } });
    const groups = groupByDay([a, b], (t) => t.due?.date, now);
    expect(groups.map((g) => g.heading)).toEqual(['Today', 'Tomorrow']);
  });

  it('puts overdue/today first in Now', () => {
    const over = mk({ due: { date: '2026-10-01' } });
    const later = mk({ due: { date: '2026-12-01' } });
    const g = groupNow([later, over], now);
    expect(g[0].tasks).toEqual([over]);
    expect(g[1].tasks).toEqual([later]);
  });
});
