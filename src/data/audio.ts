import { v7 as uuid } from 'uuid';
import { db } from './db';

/** Stores a voice note Blob in IndexedDB and returns its id (for Task.audioNoteId). */
export async function saveAudio(blob: Blob): Promise<string> {
  const id = uuid();
  await db.audio.add({ id, blob, createdAt: Date.now() });
  return id;
}

export async function getAudio(id: string): Promise<Blob | undefined> {
  return (await db.audio.get(id))?.blob;
}
