import { db } from './db';
import { addClip, createDump, deleteDump, discardIfEmpty, organizeDump, removeClip, updateDumpText } from './dumps';
import { clearUndo, undoLast } from './undo';
import type { ProposedTask } from '../domain/proposed';

const proposal = (title: string): ProposedTask => ({ id: 'p', title, urgency: 0, tags: [], status: 'open', subtasks: [] });
const live = async () => (await db.dumps.toArray()).filter((d) => !d.deletedAt && !d.organizedAt);

beforeEach(async () => {
  await db.dumps.clear();
  await db.tasks.clear();
  await db.audio.clear();
  clearUndo();
});

describe('dumps', () => {
  it('saves several dumps independently', async () => {
    const a = await createDump('first');
    const b = await createDump('second');
    await updateDumpText(a.id, 'first, edited');
    expect((await live()).map((d) => d.text).sort()).toEqual(['first, edited', 'second']);
    expect(b.id).not.toBe(a.id);
  });

  it('attaches and removes clips', async () => {
    const d = await createDump('');
    const audioId = await addClip(d.id, new Blob(['x'], { type: 'audio/webm' }));
    expect((await db.dumps.get(d.id))?.audioIds).toEqual([audioId]);
    expect(await db.audio.get(audioId)).toBeDefined();
    await removeClip(d.id, audioId);
    expect((await db.dumps.get(d.id))?.audioIds).toEqual([]);
    expect(await db.audio.get(audioId)).toBeUndefined();
  });

  it('discards only empty dumps', async () => {
    const empty = await createDump('');
    const full = await createDump('text');
    expect(await discardIfEmpty(empty.id)).toBe(true);
    expect(await discardIfEmpty(full.id)).toBe(false);
    expect(await live()).toHaveLength(1);
  });

  it('deletes softly and undoes', async () => {
    const d = await createDump('x');
    await deleteDump(d.id);
    expect(await live()).toHaveLength(0);
    await undoLast();
    expect(await live()).toHaveLength(1);
  });

  it('organizing creates tasks, hides the dump, and undo restores it', async () => {
    const d = await createDump('call ana');
    await organizeDump(d.id, [proposal('Call Ana')]);
    expect(await live()).toHaveLength(0);
    expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['Call Ana']);
    await undoLast();
    expect(await live()).toHaveLength(1);
    expect((await db.tasks.toArray()).filter((t) => !t.deletedAt)).toHaveLength(0);
  });

  it('links the first clip to the created tasks', async () => {
    const d = await createDump('x');
    const audioId = await addClip(d.id, new Blob(['x']));
    await organizeDump(d.id, [proposal('A')]);
    expect((await db.tasks.toArray())[0].audioNoteId).toBe(audioId);
  });
});
