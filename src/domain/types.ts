export type Urgency = 0 | 1 | 2 | 3; // none, low, medium, high
export type Effort = 'quick' | 'medium' | 'deep';
export type Status = 'open' | 'waiting' | 'done';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  /** Optional categorization, same vocabulary as tasks. Absent = not set. */
  due?: { date: string; time?: string };
  urgency?: Urgency;
  effort?: Effort;
  tagIds?: string[];
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: Status;
  urgency: Urgency;
  effort?: Effort;
  due?: { date: string; time?: string };
  tagIds: string[];
  waiting?: { on?: string; followUp?: string };
  subtasks: Subtask[];
  order: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  deletedAt?: number;
  audioNoteId?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  order: string;
  /** Absent on rows written before sync existed (treated as 0). */
  updatedAt?: number;
  deletedAt?: number;
}

export interface Draft {
  id: 'brain-dump';
  text: string;
  updatedAt: number;
}

/** A saved brain dump: free text plus optional voice clips, organized into tasks later (or never). */
export interface Dump {
  id: string;
  text: string;
  /** Voice recordings (ids in the `audio` table), oldest first. The text holds the transcript. */
  audioIds: string[];
  createdAt: number;
  updatedAt: number;
  /** Set when the dump was turned into tasks; hidden from the Inbox afterwards. */
  organizedAt?: number;
  deletedAt?: number;
}
