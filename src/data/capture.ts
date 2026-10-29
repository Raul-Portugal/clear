import type { ProposedTask } from '../domain/proposed';
import { createTasks } from './repo';
import { ensureTags } from './tags';
import { newSubtask } from './repo';

/** Writes the accepted proposals in one transaction-like step (a single undo entry). */
export async function commitProposed(items: ProposedTask[], audioNoteId?: string) {
  const inputs = [];
  for (const p of items) {
    inputs.push({
      title: p.title,
      audioNoteId,
      notes: p.notes,
      due: p.due,
      urgency: p.urgency,
      effort: p.effort,
      tagIds: await ensureTags(p.tags),
      subtasks: p.subtasks.map(newSubtask),
      ...(p.status === 'waiting'
        ? { status: 'waiting' as const, waiting: { on: p.waitingOn } }
        : {}),
    });
  }
  return createTasks(inputs, `${items.length} tasks added`);
}
