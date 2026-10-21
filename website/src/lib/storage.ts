import type { Prefs } from './prefs';
import type { Durations, Lang, StoredState } from './types';

export interface PomodoroStorage {
  load(): Promise<StoredState | null>;
  save(state: StoredState): Promise<void>;
  loadLang(): Promise<Lang | null>;
  saveLang(lang: Lang): Promise<void>;
  /** Web-only extras (theme, sound, goal, history); optional so stubs can skip them. */
  loadPrefs?(): Promise<unknown>;
  savePrefs?(prefs: Prefs): Promise<void>;
}

const isInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/**
 * Python int() semantics over JSON-ish values: digit strings (± sign,
 * surrounding whitespace OK), float truncation toward zero, booleans map to
 * 1/0. Non-finite numbers and anything else return null (the desktop's int()
 * would raise and discard the whole record).
 * Documented deviations from Python: underscores inside digit strings are
 * rejected, oversized digit strings lose float precision.
 */
function intCoerce(value: unknown): number | null {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^[+-]?\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : null;
  }
  return null;
}

/**
 * Defensive parser porting app.py load_state:
 *   for row in state.get("tasks", []):          # Task(**row): id/title required,
 *     tasks[task.id] = task                     #   completed defaults to False,
 *     # extra keys raise TypeError; type(task.id) is int and >= 1, title str,
 *     # completed bool — else discard. Duplicate ids overwrite (dict semantics,
 *     # last write wins).
 *   next_id   = max(int(state.get("next_id", 1)), max(tasks, default=0) + 1)
 *   durations = state.get("durations", [25, 5, 15])  # len 3, STRICT ints
 *   completed = max(0, int(state.get("completed", 0)))
 *   queue     = state.get("queue", [])          # list of STRICT ints
 *   active    = state.get("active")             # STRICT int or null
 *   day       : never validated — `completed if day == today else 0` just
 *     zeroes the counter while the tasks are kept.
 * Missing keys fall back to the desktop defaults instead of being fatal;
 * any violation discards the whole record (caller shows the warning banner
 * and uses defaults).
 */
export function parseStoredState(value: unknown): StoredState | null {
  // Desktop: state.get("tasks") — a list has no .get → AttributeError → the
  // whole record falls back to defaults, so arrays must be fatal here too.
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;

  let maxTaskId = 0;
  // tasks[task.id] = task keeps Python dict semantics: a later row with the
  // same id overwrites the earlier one while preserving insertion order.
  const taskById = new Map<number, StoredState['tasks'][number]>();
  if (raw.tasks !== undefined) {
    if (!Array.isArray(raw.tasks)) {
      return null;
    }
    for (const row of raw.tasks) {
      if (typeof row !== 'object' || row === null) {
        return null;
      }
      const task = row as Record<string, unknown>;
      // Task(**row): id/title are required and extra keys raise TypeError;
      // completed defaults to False when the key is absent.
      if (
        !('id' in task) ||
        !('title' in task) ||
        Object.keys(task).some((key) => key !== 'id' && key !== 'title' && key !== 'completed')
      ) {
        return null;
      }
      if (!isInteger(task.id) || task.id < 1) return null;
      if (typeof task.title !== 'string') return null;
      const completed = task.completed === undefined ? false : task.completed;
      if (typeof completed !== 'boolean') return null;
      maxTaskId = Math.max(maxTaskId, task.id);
      taskById.set(task.id, { id: task.id, title: task.title, completed });
    }
  }
  const tasks = Array.from(taskById.values());

  const nextIdCoerced = raw.next_id === undefined ? 1 : intCoerce(raw.next_id);
  if (nextIdCoerced === null) {
    return null;
  }

  let durations: [number, number, number] = [25, 5, 15];
  if (raw.durations !== undefined) {
    if (!Array.isArray(raw.durations) || raw.durations.length !== 3) {
      return null;
    }
    for (const duration of raw.durations) {
      if (!isInteger(duration)) return null;
    }
    durations = raw.durations as [number, number, number];
  }

  const completedCoerced = raw.completed === undefined ? 0 : intCoerce(raw.completed);
  if (completedCoerced === null) {
    return null;
  }

  if (
    raw.queue !== undefined &&
    (!Array.isArray(raw.queue) || raw.queue.some((id) => !isInteger(id)))
  ) {
    return null;
  }

  const active = raw.active === undefined ? null : raw.active;
  if (active !== null && !isInteger(active)) {
    return null;
  }

  // The desktop never validates `day`; a stale/missing day merely resets the
  // completed counter (day == today else 0) and the tasks survive.
  const day = typeof raw.day === 'string' ? raw.day : '';

  return {
    tasks,
    next_id: Math.max(nextIdCoerced, maxTaskId + 1),
    queue: (raw.queue ?? []) as StoredState['queue'],
    active: active as StoredState['active'],
    durations,
    day,
    completed: Math.max(0, completedCoerced),
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
