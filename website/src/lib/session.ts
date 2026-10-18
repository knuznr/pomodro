export class InvalidSessionCountError extends Error {
  constructor(message = 'Completed session count must be > 0') {
    super(message);
    this.name = 'InvalidSessionCountError';
  }
}

/** Port of pomodoro/session.py — long break on every 4th completed session. */
export function nextBreak(completed: number): 'short' | 'long' {
  if (completed <= 0) {
    throw new InvalidSessionCountError();
  }
  return completed % 4 !== 0 ? 'short' : 'long';
}
