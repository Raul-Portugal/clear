import { describe, expect, it } from 'vitest';
import { appendText, formatElapsed, joinResults, newWords } from './transcript';

describe('joinResults', () => {
  it('joins separate utterances (desktop Chrome)', () => {
    expect(joinResults(['Call the dentist', ' buy milk'])).toBe('Call the dentist buy milk');
  });

  it('collapses cumulative results (Android Chrome)', () => {
    expect(joinResults(['buy', 'buy milk', 'buy milk and eggs'])).toBe('buy milk and eggs');
  });

  it('drops a repeated final result', () => {
    expect(joinResults(['buy milk', 'buy milk', 'call mum'])).toBe('buy milk call mum');
  });

  it('ignores case and punctuation when collapsing', () => {
    expect(joinResults(['Buy milk', 'buy milk, and eggs.'])).toBe('buy milk, and eggs.');
  });

  it('drops a stale shorter repeat', () => {
    expect(joinResults(['buy milk and eggs', 'buy milk'])).toBe('buy milk and eggs');
  });

  it('skips empty results', () => {
    expect(joinResults(['', '  ', 'hello'])).toBe('hello');
  });

  it('keeps unrelated text that only shares letters', () => {
    expect(joinResults(['buy', 'buying a car'])).toBe('buy buying a car');
  });
});

describe('newWords', () => {
  it('returns only what was not written yet', () => {
    expect(newWords('buy milk', 'buy milk and eggs')).toBe('and eggs');
  });

  it('returns everything at first', () => {
    expect(newWords('', 'buy milk')).toBe('buy milk');
  });

  it('returns nothing when the result did not grow', () => {
    expect(newWords('buy milk and eggs', 'buy milk')).toBe('');
    expect(newWords('buy milk', 'buy milk')).toBe('');
  });

  it('a revised earlier word does not repeat the sentence', () => {
    expect(newWords('by milk', 'buy milk and eggs')).toBe('and eggs');
  });
});

describe('appendText', () => {
  it('adds one space between', () => {
    expect(appendText('Call mum', 'buy milk')).toBe('Call mum buy milk');
    expect(appendText('Call mum\n', 'buy milk')).toBe('Call mum\nbuy milk');
    expect(appendText('', 'buy milk')).toBe('buy milk');
    expect(appendText('x', '')).toBe('x');
  });
});

describe('formatElapsed', () => {
  it('formats m:ss', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(42_900)).toBe('0:42');
    expect(formatElapsed(125_000)).toBe('2:05');
  });
});
