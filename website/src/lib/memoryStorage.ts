import type { PomodoroStorage } from './storage';
import type { Lang, StoredState } from './types';

/** Fallback for when IndexedDB is unavailable (e.g. hardened private modes). */
export function createMemoryStorage(): PomodoroStorage {
  let state: StoredState | null = null;
  let lang: Lang | null = null;
  let prefs: unknown = null;
  return {
    async load() {
      return state;
    },
    async save(next) {
      state = next;
    },
    async loadLang() {
      return lang;
    },
    async saveLang(next) {
      lang = next;
    },
    async loadPrefs() {
      return prefs;
    },
    async savePrefs(next) {
      prefs = next;
    },
  };
}
