import { describe, expect, it } from 'vitest';
import { EmptyTitleError, TaskNotFoundError, TaskStore } from '../tasks';
import type { Task } from '../types';

describe('TaskStore', () => {
  it('starts with an empty pending list', () => {
    expect(new TaskStore().pending()).toEqual([]);
  });

  it('trims the title and assigns sequential ids', () => {
    const store = new TaskStore();
    const first = store.add('  Windows paketini dene  ');
    const second = store.add('README düzenle');
    expect([first.id, first.title, first.completed]).toEqual([1, 'Windows paketini dene', false]);
    expect(second.id).toBe(2);
  });

  it.each(['', '   '])('rejecting an empty title (like %j) does not consume an id', (title) => {
    const store = new TaskStore();
    expect(() => store.add(title)).toThrow(EmptyTitleError);
    expect(store.add('Geçerli görev').id).toBe(1);
  });

  it('gives duplicate titles distinct ids', () => {
    const store = new TaskStore();
    const first = store.add('Oku');
    const second = store.add('Oku');
    expect(first.id).not.toBe(second.id);
    expect(store.pending()).toHaveLength(2);
  });

  it('filters completed tasks and keeps insertion order in pending', () => {
    const store = new TaskStore();
    const first = store.add('Z raporu');
    const middle = store.add('B raporu');
    const last = store.add('A raporu');
    store.complete(middle.id);
    expect(store.pending().map((task) => task.id)).toEqual([first.id, last.id]);
    expect(store.pending().every((task) => !task.completed)).toBe(true);
  });

  it('has an empty pending list once everything is completed', () => {
    const store = new TaskStore();
    const task = store.add('Bitir');
    store.complete(task.id);
    expect(store.pending()).toEqual([]);
  });

  it('matches idempotent completion and read', () => {
    const store = new TaskStore();
    const task = store.add('Oku');
    store.complete(task.id);
    store.complete(task.id);
    expect(store.get(task.id).completed).toBe(true);
  });

  it('throws TaskNotFoundError when getting or completing a missing id', () => {
    const store = new TaskStore();
    expect(() => store.get(99)).toThrow(TaskNotFoundError);
    expect(() => store.complete(99)).toThrow(TaskNotFoundError);
    expect(() => store.get(true as unknown as number)).toThrow(TaskNotFoundError);
  });

  it('keeps stores independent', () => {
    const first = new TaskStore();
    const second = new TaskStore();
    first.add('Sadece ilk depoda');
    expect(second.pending()).toEqual([]);
    expect(second.add('İkinci depo').id).toBe(1);
  });

  it('removes a task without consuming the id stream', () => {
    const store = new TaskStore();
    const first = store.add('Oku');
    const second = store.add('Yaz');
    const removed = store.remove(first.id);
    expect(removed).toBe(first);
    expect(store.pending().map((task) => task.id)).toEqual([second.id]);
    expect(store.add('Test et').id).toBe(3);
  });

  it('throws when removing an unknown id and keeps existing tasks', () => {
    const store = new TaskStore();
    const task = store.add('Kalsın');
    expect(() => store.remove(99)).toThrow(TaskNotFoundError);
    expect(store.get(task.id)).toBe(task);
  });

  it('throws when removing the same id twice', () => {
    const store = new TaskStore();
    const task = store.add('Sil');
    store.complete(task.id);
    const removed = store.remove(task.id);
    expect(removed).toBe(task);
    expect(removed.completed).toBe(true);
    expect(() => store.get(task.id)).toThrow(TaskNotFoundError);
    expect(() => store.remove(task.id)).toThrow(TaskNotFoundError);
  });

  it('restores deletions LIFO, returns null when empty, and reuses no ids unexpectedly', () => {
    const store = new TaskStore();
    const a = store.add('Oku');
    const b = store.add('Yaz');
    store.remove(a.id);
    store.remove(b.id);
    expect(store.undoRemove()).toBe(b);
    expect(store.undoRemove()).toBe(a);
    expect(store.undoRemove()).toBeNull();
    expect(store.get(a.id)).toBe(a);
    expect(store.add('Test et').id).toBe(3);
  });

  it('load() replaces state wholesale and keeps next_id at the given value or higher', () => {
    const store = new TaskStore();
    const loaded: Task[] = [
      { id: 5, title: 'Eskiden kalmış', completed: false },
      { id: 6, title: 'Test', completed: true },
    ];
    store.load(loaded, 1); // bogus next_id — load must normalize upward
    expect(store.pending().map((task) => task.id)).toEqual([5]);
    expect(store.add('Yeni').id).toBe(7);
  });
});
