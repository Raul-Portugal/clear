import { v7 as uuid } from 'uuid';
import type { ProposedTask } from '../domain/proposed';
import type { Dump } from '../domain/types';
import { saveAudio } from './audio';
import { commitProposed } from './capture';
import { db } from './db';
import { extendLastUndo, pushUndo } from './undo';

export async function createDump(text = ''): Promise<Dump> {
  const now = Date.now();
  const dump: Dump = { id: uuid(), text, audioIds: [], createdAt: now, updatedAt: now };
  await db.dumps.add(dump);
  return dump;
}

export async function updateDumpText(id: string, text: string): Promise<void> {
  await db.dumps.update(id, { text, updatedAt: Date.now() });
}

/** Stores a recording and attaches it to the dump. */
export async function addClip(id: string, blob: Blob): Promise<string> {
  const audioId = await saveAudio(blob);
  const dump = await db.dumps.get(id);
  await db.dumps.update(id, { audioIds: [...(dump?.audioIds ?? []), audioId], updatedAt: Date.now() });
  return audioId;
}

export async function removeClip(id: string, audioId: string): Promise<void> {
  const dump = await db.dumps.get(id);
  if (!dump) return;
  await db.dumps.update(id, { audioIds: dump.audioIds.filter((a) => a !== audioId), updatedAt: Date.now() });
  await db.audio.delete(audioId);
}

/** Drops a dump that was opened but never given any content. */
export async function discardIfEmpty(id: string): Promise<boolean> {
  const dump = await db.dumps.get(id);
  if (!dump || dump.text.trim() || dump.audioIds.length) return false;
  await db.dumps.delete(id);
  return true;
}

export async function deleteDump(id: string): Promise<void> {
  const before = await db.dumps.get(id);
  if (!before) return;
  await db.dumps.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  pushUndo({ label: 'Brain dump deleted', undo: async () => void (await db.dumps.update(id, { deletedAt: undefined, updatedAt: Date.now() })) });
}

/** Creates the accepted tasks and marks the dump as organized, as one undo step. */
export async function organizeDump(id: string, items: ProposedTask[]): Promise<void> {
  const dump = await db.dumps.get(id);
  await commitProposed(items, dump?.audioIds[0]);
  await db.dumps.update(id, { organizedAt: Date.now(), updatedAt: Date.now() });
  extendLastUndo(async () => void (await db.dumps.update(id, { organizedAt: undefined, updatedAt: Date.now() })));
}
