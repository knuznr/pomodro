export interface Task {
  id: number;
  title: string;
  completed: boolean;
}

export type Phase = 'work' | 'short' | 'long';

/** Session lengths in minutes. */
export interface Durations {
  work: number;
  short: number;
  long: number;
}

export type Lang = 'tr' | 'en';

/**
 * Same JSON shape the desktop app persists in QSettings (`app.py save_state`).
 * Key names are snake_case on purpose — parity with the desktop file format.
 */
export interface StoredState {
  tasks: Task[];
  next_id: number;
  queue: number[];
  active: number | null;
  durations: [number, number, number];
  day: string;
  completed: number;
}

export const DEFAULT_DURATIONS: Durations = { work: 25, short: 5, long: 15 };
