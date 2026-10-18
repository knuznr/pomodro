import { describe, expect, it, vi } from 'vitest';
import { localIsoDate, TimerEngine } from '../timer';
import type { Durations } from '../types';

const DURATIONS: Durations = { work: 25, short: 5, long: 15 };
const SECOND = 1000;
const MINUTE = 60 * SECOND;

function makeHarness(
  durations: Durations = DURATIONS,
  options: ConstructorParameters<typeof TimerEngine>[1] = {},
) {
  let time = 0;
  const engine = new TimerEngine(durations, { now: () => time, ...options });
  return { engine, setNow: (value: number) => { time = value; } };
}

describe('TimerEngine', () => {
  it('starts idle in the work phase with full progress', () => {
    const { engine } = makeHarness();
    expect(engine.snapshot()).toMatchObject({
      phase: 'work',
      timeLeft: 1500,
      totalSeconds: 1500,
      running: false,
      progress: 100,
      pomodoroCount: 0,
      completedToday: 0,
    });
  });

  it('runs after start and turns a finished work phase into a short break', () => {
    const onPhaseEnd = vi.fn();
    const { engine, setNow } = makeHarness(DURATIONS, { onPhaseEnd });
    engine.start();
    expect(engine.snapshot().running).toBe(true);
    setNow(25 * MINUTE);
    engine.tick();
    expect(onPhaseEnd).toHaveBeenCalledTimes(1);
    expect(onPhaseEnd.mock.calls[0][0]).toBe('short');
    expect(engine.snapshot()).toMatchObject({
      phase: 'short',
      timeLeft: 300,
      totalSeconds: 300,
      pomodoroCount: 1,
      completedToday: 1,
      running: false,
      progress: 100,
    });
  });

  it('shows 00:01 through the final second, then finishes at zero', () => {
    const { engine, setNow } = makeHarness();
    engine.start();
    setNow(25 * MINUTE - 400);
    engine.tick();
    expect(engine.snapshot().timeLeft).toBe(1);
    setNow(25 * MINUTE);
    engine.tick();
    expect(engine.snapshot().phase).toBe('short');
  });

  it('pauses with the floating remaining and resumes exactly from it', () => {
    const { engine, setNow } = makeHarness();
    engine.start();
    setNow(1 * MINUTE);
    engine.tick();
    expect(engine.snapshot().timeLeft).toBe(1440);
    engine.pause();
    expect(engine.snapshot()).toMatchObject({ running: false, timeLeft: 1440 });
    setNow(2 * MINUTE);
    engine.tick();
    expect(engine.snapshot().timeLeft).toBe(1440); // no deadline → tick is a no-op
    engine.start(); // deadline = 2min + 1440s → expires at 26min
    setNow(5 * MINUTE);
    engine.tick();
    expect(engine.snapshot().timeLeft).toBe(1260);
  });

  it('finishing a break returns to work and keeps counting', () => {
    const { engine, setNow } = makeHarness();
    engine.start();
    setNow(25 * MINUTE);
    engine.tick();
    engine.start();
    setNow(30 * MINUTE);
    engine.tick();
    expect(engine.snapshot()).toMatchObject({ phase: 'work', timeLeft: 1500, pomodoroCount: 1, completedToday: 1 });
  });

  it('reset returns to the work phase at full length and keeps pomodoroCount', () => {
    const { engine, setNow } = makeHarness();
    engine.start();
    setNow(25 * MINUTE);
    engine.tick();
    engine.start();
    setNow(30 * MINUTE);
    engine.tick();
    engine.reset();
    expect(engine.snapshot()).toMatchObject({ phase: 'work', timeLeft: 1500, totalSeconds: 1500, running: false, pomodoroCount: 1 });
  });

  it('sends the 4th completed session into a long break, and that long break back to work', () => {
    const { engine, setNow } = makeHarness();
    let clock = 0;
    for (let cycle = 0; cycle < 3; cycle += 1) {
      engine.start();
      clock += 25 * MINUTE;
      setNow(clock);
      engine.tick(); // work ends
      engine.start();
      clock += 5 * MINUTE;
      setNow(clock);
      engine.tick(); // short break ends
    }
    engine.start();
    clock += 25 * MINUTE;
    setNow(clock);
    engine.tick(); // 4th work session ends
    expect(engine.snapshot()).toMatchObject({
      phase: 'long',
      totalSeconds: 900,
      timeLeft: 900,
      pomodoroCount: 4,
      completedToday: 4,
    });
    engine.start();
    clock += 15 * MINUTE;
    setNow(clock);
    engine.tick();
    expect(engine.snapshot()).toMatchObject({ phase: 'work', timeLeft: 1500, pomodoroCount: 4 });
  });

  it('tick without a deadline is a no-op even after a huge time jump', () => {
    const { engine, setNow } = makeHarness();
    setNow(10 * 60 * MINUTE);
    engine.tick();
    expect(engine.snapshot()).toMatchObject({ timeLeft: 1500, phase: 'work' });
  });

  it('one giant overdue tick finishes exactly one phase (background-tab safety)', () => {
    const onPhaseEnd = vi.fn();
    const { engine, setNow } = makeHarness(DURATIONS, { onPhaseEnd });
    engine.start();
    setNow(10 * 60 * MINUTE);
    engine.tick();
    expect(onPhaseEnd).toHaveBeenCalledTimes(1);
    expect(engine.snapshot()).toMatchObject({ phase: 'short', timeLeft: 300, pomodoroCount: 1 });
    engine.tick();
    expect(onPhaseEnd).toHaveBeenCalledTimes(1); // resting on a finished phase does not re-fire
  });

  it('drains progress from 100 to 0 during a session', () => {
    const { engine, setNow } = makeHarness();
    engine.start();
    setNow(12.5 * MINUTE); // half of 25 minutes remaining
    engine.tick();
    expect(engine.snapshot().progress).toBe(50);
    setNow(25 * MINUTE - 8 * SECOND); // 8 s left of 1500 → floor(0.53%) = 0
    engine.tick();
    expect(engine.snapshot().progress).toBe(0);
  });

  it('applies an idle duration edit to the work display', () => {
    const { engine } = makeHarness();
    engine.setDurations({ work: 30, short: 5, long: 15 });
    expect(engine.snapshot()).toMatchObject({ phase: 'work', timeLeft: 1800, totalSeconds: 1800 });
  });

  it('never applies a duration edit while paused or running', () => {
    const { engine, setNow } = makeHarness();
    engine.start();
    setNow(1 * MINUTE);
    engine.tick();
    engine.setDurations({ work: 30, short: 5, long: 15 });
    expect(engine.snapshot().timeLeft).toBe(1440);
    engine.pause();
    engine.setDurations({ work: 30, short: 5, long: 15 });
    expect(engine.snapshot().timeLeft).toBe(1440);
    engine.reset();
    engine.setDurations({ work: 30, short: 5, long: 15 });
    expect(engine.snapshot().timeLeft).toBe(1800);
  });

  it('rolloverDay resets completedToday only when the calendar day changed', () => {
    const { engine } = makeHarness(DURATIONS, {
      completedToday: 3,
      day: '2026-10-17',
      today: () => '2026-10-18',
    });
    engine.rolloverDay();
    expect(engine.snapshot().completedToday).toBe(0);
    expect(engine.currentDay()).toBe('2026-10-18');
  });

  it('rolloverDay keeps counts when the day is unchanged', () => {
    const { engine } = makeHarness(DURATIONS, {
      completedToday: 3,
      day: '2026-10-18',
      today: () => '2026-10-18',
    });
    engine.rolloverDay();
    expect(engine.snapshot().completedToday).toBe(3);
  });
});

describe('localIsoDate', () => {
  it('formats a local date, not UTC', () => {
    expect(localIsoDate(new Date(2026, 9, 18, 23, 30))).toBe('2026-10-18');
  });
});
