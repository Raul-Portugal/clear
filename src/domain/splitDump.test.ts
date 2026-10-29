import { describe, expect, it } from 'vitest';
import { splitDump } from './splitDump';

const NOW = new Date(2026, 5, 10, 9, 0); // Wed 10 Jun 2026
const tags = [{ id: 't1', name: 'Work' }];
const titles = (s: string) => splitDump(s, tags, NOW).map((t) => t.title);

describe('splitDump', () => {
  it('returns [] for empty or whitespace input', () => {
    expect(splitDump('', tags, NOW)).toEqual([]);
    expect(splitDump('  \n\t\n ', tags, NOW)).toEqual([]);
  });

  it('splits one task per line and assigns p1.. ids', () => {
    const out = splitDump('buy milk\ncall mom\nbook flights', tags, NOW);
    expect(out.map((t) => t.id)).toEqual(['p1', 'p2', 'p3']);
    expect(out.map((t) => t.title)).toEqual(['Buy milk', 'Call mom', 'Book flights']);
  });

  it('handles bullets of different kinds and skips blank lines', () => {
    expect(titles('- buy milk\n\n* call mom\n• book flights\n\n')).toEqual([
      'Buy milk',
      'Call mom',
      'Book flights',
    ]);
  });

  it('handles numbered lists with . and )', () => {
    expect(titles('1. pay rent\n2) renew passport\n3. water plants')).toEqual([
      'Pay rent',
      'Renew passport',
      'Water plants',
    ]);
  });

  it('splits a prose paragraph on sentences and strips filler', () => {
    const out = splitDump(
      'Need to call the dentist tomorrow and email Ana about the budget. Also buy milk!',
      tags,
      NOW,
    );
    expect(out.map((t) => t.title)).toEqual([
      'Call the dentist and email Ana about the budget',
      'Buy milk',
    ]);
    expect(out[0].due).toEqual({ date: '2026-06-11' });
    expect(out[1].due).toBeUndefined();
  });

  it('turns indented bullets into subtasks, one level only', () => {
    const out = splitDump(
      'Plan trip\n  - book flights\n  - find hotel\n    - compare prices\nBuy gifts',
      tags,
      NOW,
    );
    expect(out.map((t) => t.title)).toEqual(['Plan trip', 'Buy gifts']);
    expect(out[0].subtasks).toEqual(['Book flights', 'Find hotel', 'Compare prices']);
    expect(out[1].subtasks).toEqual([]);
  });

  it('supports tab-indented subtasks under a bullet', () => {
    const out = splitDump('- Groceries\n\t- eggs\n\t- bread\n- Laundry', tags, NOW);
    expect(out).toHaveLength(2);
    expect(out[0].subtasks).toEqual(['Eggs', 'Bread']);
  });

  it('strips lead-ins like "I need to", "remember to", "don\'t forget to", "todo:"', () => {
    expect(
      titles("I need to renew passport\nremember to water plants\nDon't forget to call Sam\ntodo: fix bike"),
    ).toEqual(['Renew passport', 'Water plants', 'Call Sam', 'Fix bike']);
  });

  it('parses tags, urgency, effort and dates inside lines', () => {
    const [t] = splitDump('- send report to Joe #work !! ~quick tomorrow 10:30', tags, NOW);
    expect(t.title).toBe('Send report to Joe');
    expect(t.tags).toEqual(['work']);
    expect(t.urgency).toBe(2);
    expect(t.effort).toBe('quick');
    expect(t.due).toEqual({ date: '2026-06-11', time: '10:30' });
  });

  it('captures waiting status', () => {
    const [t] = splitDump('invoice approval waiting on Marta', tags, NOW);
    expect(t.status).toBe('waiting');
    expect(t.waitingOn).toBe('Marta');
  });

  it('does not split inside times, decimals or abbreviations', () => {
    expect(titles('Meet Ana at 10.30 about the Q3 budget')).toHaveLength(1);
    expect(titles('Buy snacks, e.g. Chips and nuts for Friday')).toHaveLength(1);
    expect(titles('Ask Dr. Smith about the results')).toHaveLength(1);
    expect(titles('Pay 3.5 euros to A. Lopez')).toHaveLength(1);
  });

  it('splits on semicolons and question marks followed by a capital', () => {
    expect(titles('Call the bank; email the landlord about rent')).toEqual([
      'Call the bank',
      'Email the landlord about rent',
    ]);
    expect(titles('Is the car booked? Check the insurance papers')).toHaveLength(2);
  });

  it('splits "and then" only when both halves are long enough', () => {
    expect(titles('Go to the store and then cook dinner for everyone')).toEqual([
      'Go to the store',
      'Cook dinner for everyone',
    ]);
    expect(titles('Call Ann and then Bob')).toEqual(['Call Ann and then Bob']);
  });

  it('keeps a single short phrase as one task', () => {
    expect(titles('Milk')).toEqual(['Milk']);
  });

  it('drops pure-punctuation pieces', () => {
    expect(titles('---\n- \n...\n* buy tea\n!!!')).toEqual(['Buy tea']);
  });

  it('handles mixed prose, bullets and nested items', () => {
    const out = splitDump(
      'House chores. Wash the car!\n- Laundry\n  - whites\n  - darks\nremember to call dad\n\n2. also pay electricity bill',
      tags,
      NOW,
    );
    expect(out.map((t) => t.title)).toEqual([
      'House chores',
      'Wash the car',
      'Laundry',
      'Call dad',
      'Pay electricity bill',
    ]);
    expect(out[2].subtasks).toEqual(['Whites', 'Darks']);
    expect(out.map((t) => t.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
  });
});
