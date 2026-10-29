import type { Effort, Urgency } from '../../domain/types';

/** Labels and color tokens for urgency (warm scale) and effort (cool scale). */
export const URGENCY_LEVELS: { v: Urgency; label: string; short: string; color: string; soft: string }[] = [
  { v: 0, label: 'None', short: '', color: 'var(--text-faint)', soft: 'var(--bg-sunken)' },
  { v: 1, label: 'Low', short: 'Low', color: 'var(--urg-1)', soft: 'var(--urg-1-soft)' },
  { v: 2, label: 'Medium', short: 'Med', color: 'var(--urg-2)', soft: 'var(--urg-2-soft)' },
  { v: 3, label: 'High', short: 'High', color: 'var(--urg-3)', soft: 'var(--urg-3-soft)' },
];

export const EFFORT_LEVELS: { v: Effort; label: string; short: string; bars: 1 | 2 | 3; color: string; soft: string }[] = [
  { v: 'quick', label: 'Quick', short: 'Quick', bars: 1, color: 'var(--eff-quick)', soft: 'var(--eff-quick-soft)' },
  { v: 'medium', label: 'Medium', short: 'Med', bars: 2, color: 'var(--eff-medium)', soft: 'var(--eff-medium-soft)' },
  { v: 'deep', label: 'Deep', short: 'Deep', bars: 3, color: 'var(--eff-deep)', soft: 'var(--eff-deep-soft)' },
];

export const urgencyOf = (u: Urgency) => URGENCY_LEVELS[u];
export const effortOf = (e: Effort) => EFFORT_LEVELS.find((x) => x.v === e)!;
