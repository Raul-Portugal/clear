import { db } from './db';
import { createTasks } from './repo';
import { clearUndo } from './undo';

const KEY = 'clear-onboarded';

/** On first run with an empty database, adds three deletable tasks that teach the gestures. */
export async function seedOnboarding(): Promise<void> {
  try {
    if (localStorage.getItem(KEY)) return;
    localStorage.setItem(KEY, '1');
  } catch {
    return;
  }
  if ((await db.tasks.count()) > 0) return;
  await createTasks(
    [
      { title: 'Swipe right to complete me (or press x)', urgency: 2, effort: 'quick' },
      { title: 'Swipe left to delete me (Undo brings me back)', notes: 'Every gesture has a keyboard shortcut. Press ? to see them.' },
      { title: 'Hold and drag me up or down to reorder', effort: 'medium', subtasks: [{ id: 'sub-1', title: 'Tap a task to see its subtasks', done: false }] },
    ],
    'Welcome tasks',
  );
  clearUndo();
}
