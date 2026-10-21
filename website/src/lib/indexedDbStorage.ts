import type { PomodoroStorage } from './storage';
import type { Lang, StoredState } from './types';

const DATABASE_NAME = 'pomodro';
const DATABASE_VERSION = 1;
const STORE_NAME = 'state';

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

export function createIndexedDbStorage(factory: IDBFactory = indexedDB): PomodoroStorage {
  async function read<T>(key: string): Promise<T | null> {
    const db = await openDatabase(factory);
    try {
      return await new Promise<T | null>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
      });
    } finally {
      db.close();
    }
  }

  async function write(key: string, value: unknown): Promise<void> {
    const db = await openDatabase(factory);
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed'));
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write aborted'));
      });
    } finally {
      db.close();
    }
  }

  return {
    async load(): Promise<StoredState | null> {
      // Cast keeps the PomodoroStorage signature; validation happens in the
      // caller through parseStoredState (desktop parity — load_state rules).
      return read<StoredState>('app');
    },
    async save(state: StoredState): Promise<void> {
      await write('app', state);
    },
    async loadLang(): Promise<Lang | null> {
      return read<Lang>('lang');
    },
    async saveLang(lang: Lang): Promise<void> {
      await write('lang', lang);
    },
    async loadPrefs() {
      return read<unknown>('prefs');
    },
    async savePrefs(prefs) {
      await write('prefs', prefs);
    },
  };
}
