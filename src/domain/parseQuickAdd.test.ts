import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './parseQuickAdd';

// Wednesday 2026-10-28, 09:00 local
const now = new Date(2026, 9, 28, 9, 0, 0);
const tags = [
  { id: 't1', name: 'Health' },
  { id: 't2', name: 'work' },
];
const p = (s: string) => parseQuickAdd(s, tags, now);

describe('parseQuickAdd', () => {
  it('parses the full example', () => {
    const input = 'Call dentist tomorrow 10am !high #health ~quick';
    const r = p(input);
    expect(r.title).toBe('Call dentist');
    expect(r.due).toEqual({ date: '2026-10-29', time: '10:00' });
    expect(r.urgency).toBe(3);
    expect(r.tags).toEqual(['health']);
    expect(r.effort).toBe('quick');
    expect(r.status).toBe('open');
    expect(r.tokens.map((t) => t.kind)).toEqual(['due', 'urgency', 'tag', 'effort']);
    for (const t of r.tokens) expect(input.slice(t.start, t.end)).toBe(t.text);
    expect(r.tokens[0].text).toBe('tomorrow 10am');
  });

  it('returns defaults for plain text', () => {
    const r = p('Buy milk');
    expect(r).toEqual({ title: 'Buy milk', urgency: 0, tags: [], status: 'open', tokens: [] });
  });

  it('parses a date without a time', () => {
    const r = p('Pay rent tomorrow');
    expect(r.due).toEqual({ date: '2026-10-29' });
    expect(r.due?.time).toBeUndefined();
  });

  it('parses weekdays going forward', () => {
    expect(p('Gym friday').due?.date).toBe('2026-10-30');
    expect(p('Gym tuesday').due?.date).toBe('2026-11-03');
  });

  it('parses relative dates', () => {
    expect(p('Review in 3 days').due?.date).toBe('2026-10-31');
    expect(p('Plan next week').due?.date).toBeDefined();
  });

  it('parses month + day', () => {
    expect(p('Passport renewal Dec 5').due?.date).toBe('2026-12-05');
  });

  it('does not treat "may" as a date', () => {
    const r = p('Read may be useful');
    expect(r.due).toBeUndefined();
    expect(r.title).toBe('Read may be useful');
  });

  it('does not treat "sat" or bare numbers as dates', () => {
    expect(p('The cat sat down').due).toBeUndefined();
    const r = p('Buy 2 apples');
    expect(r.due).toBeUndefined();
    expect(r.title).toBe('Buy 2 apples');
  });

  it('parses urgency words', () => {
    expect(p('a !low').urgency).toBe(1);
    expect(p('a !med').urgency).toBe(2);
    expect(p('a !medium').urgency).toBe(2);
    expect(p('a !high').urgency).toBe(3);
  });

  it('parses bang urgency', () => {
    expect(p('a !').urgency).toBe(1);
    expect(p('a !!').urgency).toBe(2);
    expect(p('a !!!').urgency).toBe(3);
  });

  it('ignores exclamation marks attached to words', () => {
    const r = p('Hello world!');
    expect(r.urgency).toBe(0);
    expect(r.title).toBe('Hello world!');
  });

  it('parses effort', () => {
    expect(p('a ~quick').effort).toBe('quick');
    expect(p('a ~med').effort).toBe('medium');
    expect(p('a ~medium').effort).toBe('medium');
    expect(p('a ~deep').effort).toBe('deep');
  });

  it('collects tags lowercase, deduped, matching existing spelling', () => {
    const r = p('Task #Health #WORK #health #newtag');
    expect(r.tags).toEqual(['health', 'work', 'newtag']);
    expect(r.title).toBe('Task');
  });

  it('parses @waiting', () => {
    const r = p('Contract @waiting');
    expect(r.status).toBe('waiting');
    expect(r.waitingOn).toBeUndefined();
    expect(r.title).toBe('Contract');
  });

  it('parses "waiting on X" up to the next token', () => {
    const r = p('Contract waiting on Sam from legal #work !high');
    expect(r.status).toBe('waiting');
    expect(r.waitingOn).toBe('Sam from legal');
    expect(r.tags).toEqual(['work']);
    expect(r.urgency).toBe(3);
    expect(r.title).toBe('Contract');
  });

  it('stops "waiting on X" at a date', () => {
    const r = p('Quote waiting on Sam tomorrow');
    expect(r.waitingOn).toBe('Sam');
    expect(r.due?.date).toBe('2026-10-29');
    expect(r.title).toBe('Quote');
  });

  it('token ranges refer to the original input', () => {
    const input = 'Write  report #work   ~deep next friday';
    const r = p(input);
    for (const t of r.tokens) expect(input.slice(t.start, t.end)).toBe(t.text);
    expect(r.title).toBe('Write report');
    expect(r.tokens.find((t) => t.kind === 'tag')?.text).toBe('#work');
  });

  it('keeps original text as title when only a date is given', () => {
    const r = p('tomorrow');
    expect(r.title).toBe('tomorrow');
    expect(r.due).toBeUndefined();
    expect(r.tokens.some((t) => t.kind === 'due')).toBe(false);
  });

  it('handles a time-only phrase', () => {
    const r = p('Standup at 5pm');
    expect(r.due?.time).toBe('17:00');
    expect(r.title).toBe('Standup');
  });

  it('collapses whitespace in the title', () => {
    expect(p('  Fix    the   bug  !high ').title).toBe('Fix the bug');
  });

  it('handles empty input', () => {
    expect(p('').title).toBe('');
  });
});
