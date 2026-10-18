import { nextBreak } from './session';
import type { Durations, Phase } from './types';

export interface TimerSnapshot {
  phase: Phase;
  /** Whole seconds remaining in the current phase (display-ready). */
  timeLeft: number;
  totalSeconds: number;
  running: boolean;
  pomodoroCount: number;
  completedToday: number;
  /** 100 draining to 0 — desktop parity (the bar starts full). */
  progress: number;
}

export interface TimerEngineOptions {
  now?: () => number;
  today?: () => string;
  completedToday?: number;
  day?: string;
  onPhaseEnd?: (nextPhase: Phase, snapshot: TimerSnapshot) => void;
}

const toSeconds = (minutes: number): number => minutes * 60;

/** Local-date ISO string — parity with Python's date.today().isoformat(). */
export function localIsoDate(d = new Date()): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Deadline-based port of the desktop timer (app.py). Elapsed time is always
 * computed from the deadline against performance.now(), so background-tab
 * throttling can never accumulate drift. The owner renders a tick every
 * 200 ms; this engine owns the rules.
 */
export class TimerEngine {
  private durations: Durations;
  private phase: Phase = 'work';
  private remaining: number;
  private totalSeconds: number;
  private deadline: number | null = null;
  private paused = false;
  private pomodoroCount = 0;
  private completedToday: number;
  private day: string;
  private readonly now: () => number;
  private readonly today: () => string;
  private readonly onPhaseEnd?: TimerEngineOptions['onPhaseEnd'];

  constructor(durations: Durations, options: TimerEngineOptions = {}) {
    this.durations = { ...durations };
    this.remaining = toSeconds(this.durations.work);
    this.totalSeconds = this.remaining;
    this.completedToday = options.completedToday ?? 0;
    this.now = options.now ?? (() => performance.now());
    this.today = options.today ?? (() => localIsoDate());
    this.day = options.day ?? this.today();
    this.onPhaseEnd = options.onPhaseEnd;
  }

  snapshot(): TimerSnapshot {
    const timeLeft = Math.max(0, Math.ceil(this.remaining));
    const progress = this.totalSeconds > 0
      ? Math.min(100, Math.max(0, Math.floor((timeLeft / this.totalSeconds) * 100)))
      : 100;
    return {
      phase: this.phase,
      timeLeft,
      totalSeconds: this.totalSeconds,
      running: this.deadline !== null,
      pomodoroCount: this.pomodoroCount,
      completedToday: this.completedToday,
      progress,
    };
  }

  start(): void {
    if (this.deadline !== null) {
      return;
    }
    this.rolloverDay();
    this.paused = false;
    this.deadline = this.now() + this.remaining * 1000;
  }

  pause(): void {
    if (this.deadline === null) {
      return;
    }
    this.remaining = Math.max(0, (this.deadline - this.now()) / 1000);
    this.deadline = null;
    this.paused = true;
  }

  reset(): void {
    this.deadline = null;
    this.paused = false;
    this.phase = 'work';
    this.remaining = toSeconds(this.durations.work);
    this.totalSeconds = this.remaining;
  }

  tick(): void {
    if (this.deadline === null) {
      return;
    }
    this.remaining = Math.max(0, (this.deadline - this.now()) / 1000);
    if (this.remaining <= 0) {
      this.finishPhase();
    }
  }

  /**
   * Desktop rule (app.py update_work_time): an idle, never-paused work
   * display follows a new work duration immediately. Paused or mid-run
   * phases are untouched; short/long edits apply when that phase next starts.
   */
  setDurations(durations: Durations): void {
    this.durations = { ...durations };
    if (this.phase === 'work' && this.deadline === null && !this.paused) {
      this.remaining = toSeconds(this.durations.work);
      this.totalSeconds = this.remaining;
    }
  }

  rolloverDay(): void {
    const today = this.today();
    if (today !== this.day) {
      this.day = today;
      this.completedToday = 0;
    }
  }

  currentDay(): string {
    return this.day;
  }

  private finishPhase(): void {
    this.rolloverDay();
    this.deadline = null;
    this.paused = false;
    let next: Phase;
    if (this.phase === 'work') {
      this.pomodoroCount += 1;
      this.completedToday += 1;
      next = nextBreak(this.pomodoroCount) === 'long' ? 'long' : 'short';
    } else {
      next = 'work';
    }
    this.phase = next;
    const minutes = next === 'work'
      ? this.durations.work
      : next === 'short'
        ? this.durations.short
        : this.durations.long;
    this.remaining = toSeconds(minutes);
    this.totalSeconds = this.remaining;
    this.onPhaseEnd?.(next, this.snapshot());
  }
}
