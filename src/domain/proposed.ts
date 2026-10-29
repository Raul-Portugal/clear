import type { Effort, Urgency } from './types';

/** A task suggested from a brain dump, editable on the review screen before it is created. */
export interface ProposedTask {
  id: string;
  title: string;
  due?: { date: string; time?: string };
  urgency: Urgency;
  effort?: Effort;
  /** Lowercase tag names, no `#`. */
  tags: string[];
  status: 'open' | 'waiting';
  waitingOn?: string;
  notes?: string;
  subtasks: string[];
}
