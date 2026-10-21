import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, lastDays, parsePrefs, parseSpotify, siteTheme, withHistory } from '../prefs';
import { TimerEngine } from '../timer';

describe('prefs', () => {
  it('falls back to defaults and clamps bad values', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    const p = parsePrefs({ theme: 'light', sound: 'nope', goal: 99, history: { '2026-01-02': 3, bad: 2, '2026-01-03': -1 } });
    expect(p).toMatchObject({ theme: 'light', sound: 'chime', goal: 24, history: { '2026-01-02': 3 } });
  });

  it('keeps the newest 30 days and builds a 7-day window across month ends', () => {
    let h: Record<string, number> = {};
    for (const day of lastDays('2026-03-31', 40)) h = withHistory(h, day, 1);
    expect(Object.keys(h)).toHaveLength(30);
    expect(lastDays('2026-03-02', 4)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(withHistory({ '2026-01-01': 2 }, '2026-01-01', 0)).toEqual({});
  });
});

describe('parseSpotify', () => {
  it('turns links and URIs into embed paths and rejects the rest', () => {
    expect(parseSpotify('https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS?si=abc')).toBe('playlist/37i9dQZF1DX8Uebhn9wzrS');
    expect(parseSpotify('https://open.spotify.com/intl-tr/album/4aawyAB9vmqN3uQ7FjRGTy')).toBe('album/4aawyAB9vmqN3uQ7FjRGTy');
    expect(parseSpotify('spotify:track:11dFghVXANMlKmJXsNCbNl')).toBe('track/11dFghVXANMlKmJXsNCbNl');
    expect(parseSpotify('https://evil.com/?u=open.spotify.com/playlist/x')).toBeNull();
    expect(parsePrefs({ spotify: 'playlist/../x' }).spotify).toBe('');
  });
});

describe('siteTheme', () => {
  it('reads the portfolio theme key and rejects anything else', () => {
    try {
      localStorage.setItem('theme', 'light');
      expect(siteTheme()).toBe('light');
      localStorage.setItem('theme', 'dark');
      expect(siteTheme()).toBe('dark');
      localStorage.setItem('theme', 'weird');
      expect(siteTheme()).toBeNull();
      localStorage.removeItem('theme');
      expect(siteTheme()).toBeNull();
    } finally {
      localStorage.removeItem('theme');
    }
  });
});

describe('TimerEngine.selectPhase', () => {
  it('switches phase while idle and is ignored while running', () => {
    const engine = new TimerEngine({ work: 25, short: 5, long: 15 }, { now: () => 0 });
    engine.selectPhase('long');
    expect(engine.snapshot()).toMatchObject({ phase: 'long', timeLeft: 900, running: false });
    engine.start();
    engine.selectPhase('short');
    expect(engine.snapshot().phase).toBe('long');
  });
});

describe('auto-start and skip/extend', () => {
  it('maps the phase that just began to its own pref', async () => {
    const { shouldAutoStart } = await import('../prefs');
    const prefs = { autoBreak: true, autoWork: false };
    expect(shouldAutoStart(prefs, 'short')).toBe(true);
    expect(shouldAutoStart(prefs, 'long')).toBe(true);
    expect(shouldAutoStart(prefs, 'work')).toBe(false);
    expect(parsePrefs({ autoWork: true }).autoWork).toBe(true);
  });

  it('skip never credits a work session; extend grows time and total', () => {
    let now = 0;
    const engine = new TimerEngine({ work: 25, short: 5, long: 15 }, { now: () => now });
    engine.start();
    engine.skip();
    expect(engine.snapshot()).toMatchObject({ phase: 'short', timeLeft: 300, running: true, pomodoroCount: 0, completedToday: 0 });
    now = 60_000;
    engine.extend(5);
    engine.tick();
    expect(engine.snapshot()).toMatchObject({ timeLeft: 540, totalSeconds: 600 });
    engine.pause();
    engine.skip();
    expect(engine.snapshot()).toMatchObject({ phase: 'work', running: false, timeLeft: 1500 });
    engine.extend(1);
    expect(engine.snapshot()).toMatchObject({ timeLeft: 1560, totalSeconds: 1560 });
  });
});
