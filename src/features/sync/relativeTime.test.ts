import { relativeTime } from './relativeTime';

it('formats relative time', () => {
  const now = 1_000_000_000;
  expect(relativeTime(now - 10_000, now)).toBe('just now');
  expect(relativeTime(now - 3 * 60_000, now)).toBe('3 min ago');
  expect(relativeTime(now - 2 * 3_600_000, now)).toBe('2 h ago');
  expect(relativeTime(now - 3 * 86_400_000, now)).toBe('3 d ago');
});
