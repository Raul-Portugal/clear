export interface UndoEntry {
  label: string;
  undo: () => Promise<void>;
}

const MAX = 20;
const stack: UndoEntry[] = [];

export function pushUndo(entry: UndoEntry) {
  stack.push(entry);
  if (stack.length > MAX) stack.shift();
}

/** Pops and runs the latest undo entry; returns its label, or null when empty. */
export async function undoLast(): Promise<string | null> {
  const entry = stack.pop();
  if (!entry) return null;
  await entry.undo();
  return entry.label;
}

export function canUndo(): boolean {
  return stack.length > 0;
}

export function clearUndo() {
  stack.length = 0;
}

/** Makes the latest undo entry also run `extra` (used to restore a dump together with its tasks). */
export function extendLastUndo(extra: () => Promise<void>) {
  const top = stack.at(-1);
  if (!top) return;
  const original = top.undo;
  top.undo = async () => {
    await original();
    await extra();
  };
}
