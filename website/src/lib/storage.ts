import type { Durations, Lang, StoredState } from './types';

export interface PomodoroStorage {
  load(): Promise<StoredState | null>;
  save(state: StoredState): Promise<void>;
  loadLang(): Promise<Lang | null>;
  saveLang(lang: Lang): Promise<void>;
}

const isInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/**
 * Defensive parser mirroring app.py load_state: any violation discards the
 * whole record (caller shows the warning banner and uses defaults).
 */
export function parseStoredState(value: unknown): StoredState | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;

  if (!Array.isArray(raw.tasks)) {
    return null;
  }
  for (const row of raw.tasks) {
    if (typeof row !== 'object' || row === null) {
      return null;
    }
    const task = row as Record<string, unknown>;
    if (!isInteger(task.id) || task.id < 1) return null;
    if (typeof task.title !== 'string') return null;
    if (typeof task.completed !== 'boolean') return null;
  }

  if (!isInteger(raw.next_id) || raw.next_id < 1) {
    return null;
  }
  if (!Array.isArray(raw.durations) || raw.durations.length !== 3) {
    return null;
  }
  for (const duration of raw.durations) {
    if (!isInteger(duration)) return null;
  }
  if (!isInteger(raw.completed) || raw.completed < 0) {
    return null;
  }
  if (!Array.isArray(raw.queue) || raw.queue.some((id) => !isInteger(id))) {
    return null;
  }
  if (raw.active !== null && !isInteger(raw.active)) {
    return null;
  }
  if (typeof raw.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.day)) {
    return null;
  }

  const maxTaskId = (raw.tasks as Array<Record<string, unknown>>).reduce(
    (max, task) => Math.max(max, task.id as number),
    0,
  );
  return {
    tasks: raw.tasks as StoredState['tasks'],
    next_id: Math.max(raw.next_id, maxTaskId + 1),
    queue: raw.queue as StoredState['queue'],
    active: (raw.active ?? null) as StoredState['active'],
    durations: raw.durations as StoredState['durations'],
    day: raw.day,
    completed: raw.completed,
  };
}

/**
 * QSpinBox.setValue parity: on load the desktop clamps durations into the
 * configured ranges instead of failing them.
 */
export function toDurations(tuple: [number, number, number]): Durations {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  return {
    work: clamp(tuple[0], 1, 60),
    short: clamp(tuple[1], 1, 30),
    long: clamp(tuple[2], 1, 60),
  };
}
