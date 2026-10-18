import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createIndexedDbStorage } from '../indexedDbStorage';
import { createMemoryStorage } from '../memoryStorage';
import type { StoredState } from '../types';

const validState: StoredState = {
  tasks: [{ id: 1, title: 'Oku', completed: false }],
  next_id: 2,
  queue: [1],
  active: 1,
  durations: [25, 5, 15],
  day: '2026-10-18',
  completed: 3,
};

describe('createIndexedDbStorage', () => {
  it('round-trips the state through IndexedDB', async () => {
    const storage = createIndexedDbStorage(new IDBFactory());
    await storage.save(validState);
    await expect(storage.load()).resolves.toEqual(validState);
  });

  it('round-trips the language', async () => {
    const storage = createIndexedDbStorage(new IDBFactory());
    await storage.saveLang('en');
    await expect(storage.loadLang()).resolves.toBe('en');
  });

  it('returns null for both records on an empty database', async () => {
    const storage = createIndexedDbStorage(new IDBFactory());
    await expect(storage.load()).resolves.toBeNull();
    await expect(storage.loadLang()).resolves.toBeNull();
  });

  it('overwrites previous saves', async () => {
    const storage = createIndexedDbStorage(new IDBFactory());
    await storage.save(validState);
    const next: StoredState = {
      ...validState,
      completed: 4,
      tasks: validState.tasks.concat([{ id: 2, title: 'Yaz', completed: false }]),
    };
    await storage.save(next);
    await expect(storage.load()).resolves.toEqual(next);
  });

  it('isolates between separate factories (distinct test databases)', async () => {
    const first = createIndexedDbStorage(new IDBFactory());
    await first.save(validState);
    const second = createIndexedDbStorage(new IDBFactory());
    await expect(second.load()).resolves.toBeNull();
  });
});

describe('createMemoryStorage', () => {
  it('round-trips within a session and starts empty for a new one', async () => {
    const storage = createMemoryStorage();
    await storage.save(validState);
    await storage.saveLang('tr');
    await expect(storage.load()).resolves.toEqual(validState);
    await expect(storage.loadLang()).resolves.toBe('tr');
    await expect(createMemoryStorage().load()).resolves.toBeNull();
  });
});
