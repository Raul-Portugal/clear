import { db } from './db';
import { createTask, setDone, softDelete, reorder, setSubtasks, newSubtask } from './repo';
import { undoLast, clearUndo } from './undo';

beforeEach(async () => {
  await db.tasks.clear();
  clearUndo();
});

const live = async () => (await db.tasks.toArray()).filter((t) => !t.deletedAt);

describe('repo', () => {
  it('creates tasks with increasing order', async () => {
    const a = await createTask({ title: 'a' });
    const b = await createTask({ title: 'b' });
    expect(a.order < b.order).toBe(true);
    expect(a.status).toBe('open');
  });

  it('completes and undoes', async () => {
    const t = await createTask({ title: 'x' });
    await setDone(t.id, true);
    expect((await db.tasks.get(t.id))?.status).toBe('done');
    expect(await undoLast()).toBe('Task completed');
    expect((await db.tasks.get(t.id))?.status).toBe('open');
  });

  it('soft deletes and undoes', async () => {
    const t = await createTask({ title: 'x' });
    await softDelete(t.id);
    expect(await live()).toHaveLength(0);
    await undoLast();
    expect(await live()).toHaveLength(1);
  });

  it('undoing a create hides the task', async () => {
    await createTask({ title: 'x' });
    await undoLast();
    expect(await live()).toHaveLength(0);
  });

  it('reorders between neighbours', async () => {
    const a = await createTask({ title: 'a' });
    const b = await createTask({ title: 'b' });
    const c = await createTask({ title: 'c' });
    await reorder(c.id, a.order, b.order);
    const ordered = (await db.tasks.orderBy('order').toArray()).map((t) => t.title);
    expect(ordered).toEqual(['a', 'c', 'b']);
  });

  it('keeps subtasks and undoes the change', async () => {
    const t = await createTask({ title: 'x' });
    await setSubtasks(t.id, [newSubtask('one')]);
    expect((await db.tasks.get(t.id))?.subtasks).toHaveLength(1);
    await undoLast();
    expect((await db.tasks.get(t.id))?.subtasks).toHaveLength(0);
  });

  it('undo stack is empty after exhausting', async () => {
    expect(await undoLast()).toBeNull();
  });
});

describe('addSubtask', () => {
  it('keeps every subtask when adds overlap', async () => {
    const t = await createTask({ title: 'x' });
    const { addSubtask } = await import('./repo');
    await Promise.all(['a', 'b', 'c'].map((n) => addSubtask(t.id, n)));
    expect((await db.tasks.get(t.id))?.subtasks.map((s) => s.title)).toEqual(['a', 'b', 'c']);
  });
});

describe('addTaskTag', () => {
  it('keeps every tag when adds overlap, and skips duplicates', async () => {
    const t = await createTask({ title: 'x' });
    const { addTaskTag } = await import('./repo');
    await Promise.all(['a', 'b', 'a'].map((id) => addTaskTag(t.id, id)));
    expect((await db.tasks.get(t.id))?.tagIds).toEqual(['a', 'b']);
  });
});
