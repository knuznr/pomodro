import { describe, expect, it } from 'vitest';
import { FocusQueue } from '../focusQueue';
import { TaskNotFoundError, TaskStore } from '../tasks';
import type { Task } from '../types';

describe('FocusQueue', () => {
  it('keeps enqueue order and never duplicates an id', () => {
    const store = new TaskStore();
    const first = store.add('Oku');
    const second = store.add('Yaz');
    const queue = new FocusQueue(store);
    queue.enqueue(second.id);
    queue.enqueue(first.id);
    queue.enqueue(second.id);
    expect(queue.queue).toEqual([second.id, first.id]);
  });

  it('leaves the queue unchanged when enqueuing a missing task', () => {
    const store = new TaskStore();
    const task = store.add('Oku');
    const queue = new FocusQueue(store);
    queue.enqueue(task.id);
    expect(() => queue.enqueue(99)).toThrow(TaskNotFoundError);
    expect(queue.queue).toEqual([task.id]);
  });

  it.each([false, true])(
    'rejects enqueuing a completed task (already queued: %j)',
    (alreadyQueued) => {
      const store = new TaskStore();
      const task = store.add('Oku');
      const queue = new FocusQueue(store);
      if (alreadyQueued) {
        queue.enqueue(task.id);
      }
      const before = [...queue.queue];
      store.complete(task.id);
      expect(() => queue.enqueue(task.id)).toThrow(/already completed/);
      expect(queue.queue).toEqual(before);
    },
  );

  it('returns null when the queue is empty', () => {
    const queue = new FocusQueue(new TaskStore());
    expect(queue.takeNext()).toBeNull();
  });

  it('pops FIFO and leaves taken tasks in the store untouched', () => {
    const store = new TaskStore();
    const first = store.add('Oku');
    const second = store.add('Yaz');
    const queue = new FocusQueue(store);
    queue.enqueue(second.id);
    queue.enqueue(first.id);

    expect(queue.takeNext()).toBe(second);
    expect(queue.takeNext()).toBe(first);
    expect(queue.takeNext()).toBeNull();
    expect(store.get(first.id)).toBe(first);
    expect(store.get(second.id)).toBe(second);
    expect(first.completed).toBe(false);
    expect(second.completed).toBe(false);
  });

  it('skips deleted and completed tasks when taking', () => {
    const store = new TaskStore();
    const deleted = store.add('Silinecek');
    const completed = store.add('Tamamlanacak');
    const active = store.add('Yapılacak');
    const queue = new FocusQueue(store);
    queue.enqueue(deleted.id);
    queue.enqueue(completed.id);
    queue.enqueue(active.id);
    store.remove(deleted.id);
    store.complete(completed.id);

    expect(queue.takeNext()).toBe(active);
    expect(queue.takeNext()).toBeNull();
    expect(store.get(active.id).completed).toBe(false);
  });

  it('returns null and drains the queue when every task is invalid', () => {
    const store = new TaskStore();
    const deleted = store.add('Sil');
    const completed = store.add('Bitir');
    const queue = new FocusQueue(store);
    queue.enqueue(deleted.id);
    queue.enqueue(completed.id);
    store.remove(deleted.id);
    store.complete(completed.id);

    expect(queue.takeNext()).toBeNull();
    expect(queue.queue).toEqual([]);
  });

  it('allows taking and re-enqueuing the same task', () => {
    const store = new TaskStore();
    const task = store.add('Tekrar odaklan');
    const queue = new FocusQueue(store);
    queue.enqueue(task.id);
    expect(queue.takeNext()).toBe(task);
    queue.enqueue(task.id);
    expect(queue.takeNext()).toBe(task);
    expect(queue.takeNext()).toBeNull();
  });

  it('pendingIds is non-consuming and follows deleted/restored/completed tasks', () => {
    const store = new TaskStore();
    const a = store.add('A');
    const b = store.add('B');
    const queue = new FocusQueue(store);
    queue.enqueue(a.id);
    queue.enqueue(b.id);
    store.remove(a.id);
    expect(queue.pendingIds()).toEqual([b.id]);
    store.undoRemove();
    expect(queue.pendingIds()).toEqual([a.id, b.id]);
    store.complete(b.id);
    expect(queue.pendingIds()).toEqual([a.id]);
    expect(queue.takeNext()).toBe(a);
    expect(queue.takeNext()).toBeNull();
  });

  it('exposes queue as a plain number array (App persistence contract)', () => {
    const store = new TaskStore();
    const task: Task = store.add('Seri');
    const queue = new FocusQueue(store);
    queue.enqueue(task.id);
    expect(Array.isArray(queue.queue)).toBe(true);
    expect(queue.queue.every((id) => typeof id === 'number')).toBe(true);
  });
});
