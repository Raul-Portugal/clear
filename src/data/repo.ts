import { generateKeyBetween } from 'fractional-indexing';
import { v7 as uuid } from 'uuid';
import type { Subtask, Task } from '../domain/types';
import { db } from './db';
import { pushUndo } from './undo';

export type NewTask = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order'>> & {
  title: string;
};

async function lastOrder(): Promise<string | null> {
  const last = await db.tasks.orderBy('order').last();
  return last?.order ?? null;
}

/** Records an undo that restores `before` (or soft-deletes when the task did not exist). */
function recordUndo(label: string, before: Task | undefined, id: string) {
  pushUndo({
    label,
    undo: async () => {
      if (before) await db.tasks.put({ ...before, updatedAt: Date.now() });
      else await db.tasks.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
    },
  });
}

export async function createTask(input: NewTask, label = 'Task added'): Promise<Task> {
  const now = Date.now();
  const task: Task = {
    status: 'open',
    urgency: 0,
    tagIds: [],
    subtasks: [],
    ...input,
    id: uuid(),
    order: generateKeyBetween(await lastOrder(), null),
    createdAt: now,
    updatedAt: now,
  };
  await db.tasks.add(task);
  recordUndo(label, undefined, task.id);
  return task;
}

/** Creates several tasks in one transaction, as a single undo step. */
export async function createTasks(inputs: NewTask[], label: string): Promise<Task[]> {
  const now = Date.now();
  let prev = await lastOrder();
  const tasks = inputs.map((input): Task => {
    const order = generateKeyBetween(prev, null);
    prev = order;
    return {
      status: 'open', urgency: 0, tagIds: [], subtasks: [], ...input,
      id: uuid(), order, createdAt: now, updatedAt: now,
    };
  });
  await db.tasks.bulkAdd(tasks);
  const ids = tasks.map((t) => t.id);
  pushUndo({
    label,
    undo: async () => {
      const t = Date.now();
      await db.tasks.bulkUpdate(ids.map((id) => ({ key: id, changes: { deletedAt: t, updatedAt: t } })));
    },
  });
  return tasks;
}

export async function updateTask(
  id: string,
  changes: Partial<Omit<Task, 'id' | 'createdAt'>>,
  label = 'Task updated',
  { undoable = true }: { undoable?: boolean } = {},
): Promise<void> {
  const before = await db.tasks.get(id);
  if (!before) return;
  await db.tasks.update(id, { ...changes, updatedAt: Date.now() });
  if (undoable) recordUndo(label, before, id);
}

export async function setDone(id: string, done: boolean): Promise<void> {
  const now = Date.now();
  await updateTask(
    id,
    done
      ? { status: 'done', completedAt: now }
      : { status: 'open', completedAt: undefined },
    done ? 'Task completed' : 'Task reopened',
  );
}

export async function setWaiting(id: string, waiting: boolean, on?: string, followUp?: string) {
  await updateTask(
    id,
    waiting
      ? { status: 'waiting', waiting: { on, followUp } }
      : { status: 'open', waiting: undefined },
    waiting ? 'Marked waiting' : 'Back to open',
  );
}

export async function softDelete(id: string): Promise<void> {
  await updateTask(id, { deletedAt: Date.now() }, 'Task deleted');
}

/** Moves a task between neighbours (by their order keys; null = list edge). */
export async function reorder(id: string, before: string | null, after: string | null) {
  await updateTask(id, { order: generateKeyBetween(before, after) }, 'Task moved');
}

/** Applies several order keys at once (one drag), as a single undo step. */
export async function setOrders(changes: { id: string; order: string }[], label = 'Task moved') {
  if (changes.length === 0) return;
  const before = await db.tasks.bulkGet(changes.map((c) => c.id));
  const now = Date.now();
  await db.tasks.bulkUpdate(changes.map((c) => ({ key: c.id, changes: { order: c.order, updatedAt: now } })));
  pushUndo({
    label,
    undo: async () => {
      const t = Date.now();
      await db.tasks.bulkUpdate(
        before.filter((b): b is Task => !!b).map((b) => ({ key: b.id, changes: { order: b.order, updatedAt: t } })),
      );
    },
  });
}

export async function setSubtasks(id: string, subtasks: Subtask[], label = 'Subtasks updated') {
  await updateTask(id, { subtasks }, label);
}

let subtaskQueue: Promise<unknown> = Promise.resolve();

/** Appends a subtask to the stored task. Adds run one at a time, so quick successive adds never clobber each other. */
export function addSubtask(id: string, title: string, extra: Partial<Omit<Subtask, 'id' | 'title'>> = {}): Promise<void> {
  const run = async () => {
    const t = await db.tasks.get(id);
    if (t) await setSubtasks(id, [...t.subtasks, { ...newSubtask(title), ...extra }], 'Subtask added');
  };
  const next = subtaskQueue.then(run, run);
  subtaskQueue = next.catch(() => undefined);
  return next;
}

let tagQueue: Promise<unknown> = Promise.resolve();

/** Adds a tag to the stored task (no-op if present). Serialized like addSubtask, so tags typed in quick succession all land. */
export function addTaskTag(id: string, tagId: string): Promise<void> {
  const run = async () => {
    const t = await db.tasks.get(id);
    if (t && !t.tagIds.includes(tagId)) await updateTask(id, { tagIds: [...t.tagIds, tagId] }, 'Tags changed');
  };
  const next = tagQueue.then(run, run);
  tagQueue = next.catch(() => undefined);
  return next;
}

export function newSubtask(title: string): Subtask {
  return { id: uuid(), title, done: false };
}
