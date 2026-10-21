export type Theme = 'dark' | 'light';
export type Sound = 'chime' | 'bell' | 'soft' | 'off';

export const SOUNDS: readonly Sound[] = ['chime', 'bell', 'soft', 'off'];
export const HISTORY_DAYS = 30;
export const GOAL_RANGE = { min: 1, max: 24 } as const;

/** Web-only extras; the desktop-parity StoredState record stays untouched. */
export interface Prefs {
  theme: Theme;
  sound: Sound;
  notifications: boolean;
  /** Start the break by itself when a work session ends. */
  autoBreak: boolean;
  /** Start the next work session by itself when a break ends. */
  autoWork: boolean;
  /** Spotify embed path, e.g. "playlist/37i9…"; empty = no player. */
  spotify: string;
  /** Daily pomodoro goal. */
  goal: number;
  /** ISO day → completed work sessions (last HISTORY_DAYS days). */
  history: Record<string, number>;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  sound: 'chime',
  notifications: false,
  autoBreak: false,
  autoWork: false,
  spotify: '',
  goal: 4,
  history: {},
};

const SPOTIFY_PATH = /^(playlist|album|track|artist|show|episode)\/[A-Za-z0-9]+$/;

/** Pasted open.spotify.com URL or spotify: URI → embed path, or null if it isn't one. */
export function parseSpotify(input: string): string | null {
  const m = input.trim().match(/^(?:https:\/\/open\.spotify\.com\/(?:intl-\w+\/)?|spotify:)(playlist|album|track|artist|show|episode)[/:]([A-Za-z0-9]+)/);
  return m ? `${m[1]}/${m[2]}` : null;
}

export function parsePrefs(value: unknown): Prefs {
  if (typeof value !== 'object' || value === null) return DEFAULT_PREFS;
  const raw = value as Record<string, unknown>;
  const history: Record<string, number> = {};
  if (typeof raw.history === 'object' && raw.history !== null) {
    for (const [day, n] of Object.entries(raw.history)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isInteger(n) && (n as number) > 0) {
        history[day] = n as number;
      }
    }
  }
  const goal = Number.isInteger(raw.goal) ? (raw.goal as number) : DEFAULT_PREFS.goal;
  return {
    theme: raw.theme === 'light' ? 'light' : 'dark',
    sound: SOUNDS.includes(raw.sound as Sound) ? (raw.sound as Sound) : DEFAULT_PREFS.sound,
    notifications: raw.notifications === true,
    autoBreak: raw.autoBreak === true,
    autoWork: raw.autoWork === true,
    spotify: typeof raw.spotify === 'string' && SPOTIFY_PATH.test(raw.spotify) ? raw.spotify : '',
    goal: Math.min(GOAL_RANGE.max, Math.max(GOAL_RANGE.min, goal)),
    history,
  };
}

/** The portfolio's own theme key, when it chose a valid one. */
export function siteTheme(): Theme | null {
  try {
    const value = localStorage.getItem('theme');
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Whether the phase the engine just advanced TO should start on its own. */
export function shouldAutoStart(prefs: Pick<Prefs, 'autoBreak' | 'autoWork'>, nextPhase: 'work' | 'short' | 'long') {
  return nextPhase === 'work' ? prefs.autoWork : prefs.autoBreak;
}

/** Records today's count and drops everything older than HISTORY_DAYS entries. */
export function withHistory(history: Record<string, number>, day: string, count: number) {
  const next = { ...history };
  if (count > 0) next[day] = count;
  else delete next[day];
  const days = Object.keys(next).sort().slice(-HISTORY_DAYS);
  return Object.fromEntries(days.map((d) => [d, next[d]]));
}

/** Last `n` ISO days ending at `today`, oldest first. */
export function lastDays(today: string, n: number): string[] {
  const [y, m, d] = today.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(y, m - 1, d - (n - 1 - i));
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${mm}-${dd}`;
  });
}
