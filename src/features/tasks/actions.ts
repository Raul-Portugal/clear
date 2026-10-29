import { create } from 'zustand';
import { setDone, softDelete } from '../../data/repo';
import { undoLast } from '../../data/undo';
import { useToast } from '../../ui/Toast';
import type { Task } from '../../domain/types';

interface UiState {
  detailId: string | null;
  quickAdd: boolean;
  selectedId: string | null;
  visibleIds: string[];
  searching: boolean;
  cheatSheet: boolean;
  palette: boolean;
  menu: boolean;
  brainDump: boolean;
  /** Which saved dump the editor opens (null = a new one). */
  dumpId: string | null;
  /** Jump straight to the review screen when the editor opens. */
  autoOrganize: boolean;
  /** Start voice recording as soon as the brain dump opens. */
  autoListen: boolean;
  set: (p: Partial<Omit<UiState, "set">>) => void;
  openDetail: (id: string | null) => void;
  setQuickAdd: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  detailId: null,
  quickAdd: false,
  selectedId: null,
  visibleIds: [],
  searching: false,
  cheatSheet: false,
  palette: false,
  menu: false,
  brainDump: false,
  dumpId: null,
  autoOrganize: false,
  autoListen: false,
  set: (p) => set(p),
  openDetail: (detailId) => set({ detailId }),
  setQuickAdd: (quickAdd) => set({ quickAdd }),
}));

/** Runs the latest undo and tells the user what was reverted. */
export async function undo() {
  const label = await undoLast();
  if (label) useToast.getState().show(`Undid: ${label.toLowerCase()}`);
}

export function toastWithUndo(message: string) {
  useToast.getState().show(message, { label: 'Undo', run: () => void undoLast() });
}

export async function completeTask(task: Task, done: boolean) {
  await setDone(task.id, done);
  toastWithUndo(done ? 'Completed' : 'Reopened');
}

export async function deleteTask(task: Task) {
  await softDelete(task.id);
  if (useUi.getState().detailId === task.id) useUi.getState().openDetail(null);
  toastWithUndo('Task deleted');
}
