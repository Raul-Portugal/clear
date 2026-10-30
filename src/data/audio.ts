import { v7 as uuid } from 'uuid';
import { db } from './db';

/** Where recordings live remotely. Optional: without it, audio stays on the device. */
export interface AudioRemote {
  upload(id: string, blob: Blob): Promise<void>;
  /** Null when the recording isn't there (not uploaded yet, or removed). */
  download(id: string): Promise<Blob | null>;
  remove(id: string): Promise<void>;
}

/** Stores a voice note Blob in IndexedDB and returns its id (for Task.audioNoteId). */
export async function saveAudio(blob: Blob): Promise<string> {
  const id = uuid();
  await db.audio.add({ id, blob, createdAt: Date.now(), pendingUpload: 1 });
  return id;
}

export async function getAudio(id: string): Promise<Blob | undefined> {
  return (await db.audio.get(id))?.blob;
}

/** Removes a recording here, and queues its remote removal unless it was never uploaded. */
export async function deleteAudio(id: string): Promise<void> {
  const row = await db.audio.get(id);
  if (row?.pendingUpload) await db.audio.delete(id);
  else await db.audio.put({ id, createdAt: row?.createdAt ?? Date.now(), pendingDelete: 1 });
}

/** Ids among `ids` recorded here and not uploaded yet: the remote can't know about them. */
export async function pendingUploads(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db.audio.bulkGet(ids);
  return rows.filter((r) => r?.pendingUpload).map((r) => r!.id);
}

/**
 * Pushes queued removals and uploads, then downloads the recordings in `wanted` that this device lacks.
 * A failed download is skipped (the next sync retries); a failed upload or removal throws.
 */
export async function syncAudio(remote: AudioRemote, wanted: string[]): Promise<void> {
  for (const id of await db.audio.where('pendingDelete').equals(1).primaryKeys()) {
    await remote.remove(id);
    await db.audio.delete(id);
  }
  for (const id of await db.audio.where('pendingUpload').equals(1).primaryKeys()) {
    const row = await db.audio.get(id);
    if (!row?.blob) continue;
    await remote.upload(id, row.blob);
    await db.audio.update(id, { pendingUpload: undefined });
  }
  const have = new Set(await db.audio.bulkGet(wanted).then((rows) => rows.filter(Boolean).map((r) => r!.id)));
  for (const id of wanted) {
    if (have.has(id)) continue;
    const blob = await remote.download(id).catch(() => null);
    if (blob && !(await db.audio.get(id))) await db.audio.add({ id, blob, createdAt: Date.now() });
  }
}
