import { describe, expect, it } from 'vitest';
import { parseStoredState, toDurations } from '../storage';
import type { StoredState } from '../types';

const validState: StoredState = {
  tasks: [{ id: 1, title: 'Oku', completed: false }],
  next_id: 2,
  queue: [1],
  active: 1,
  durations: [25, 5, 15],
  day: '2026-10-18',
  completed: 3,
};

describe('parseStoredState', () => {
  it('accepts a valid state untouched', () => {
    expect(parseStoredState(validState)).toEqual(validState);
  });

  it('normalizes next_id up to max(task ids) + 1', () => {
    const broken: StoredState = {
      ...validState,
      next_id: 1,
      tasks: [{ id: 5, title: 'Eski', completed: false }],
    };
    const parsed = parseStoredState(broken);
    expect(parsed?.next_id).toBe(6);
  });

  it.each([
    ['null input', null],
    ['string input', 'nope'],
    ['tasks not an array', { ...validState, tasks: {} }],
    ['task row not an object', { ...validState, tasks: ['x'] }],
    ['task id non-integer', { ...validState, tasks: [{ id: 1.5, title: 'x', completed: false }] }],
    ['task id below 1', { ...validState, tasks: [{ id: 0, title: 'x', completed: false }] }],
    ['task title not a string', { ...validState, tasks: [{ id: 1, title: 5, completed: false }] }],
    ['task completed not boolean', { ...validState, tasks: [{ id: 1, title: 'x', completed: 'no' }] }],
    ['next_id not an integer', { ...validState, next_id: '2' }],
    ['durations wrong length', { ...validState, durations: [25, 5] }],
    ['durations non-numeric', { ...validState, durations: [25, 'x', 15] }],
    ['completed negative', { ...validState, completed: -1 }],
    ['completed non-integer', { ...validState, completed: 1.5 }],
    ['queue not an array', { ...validState, queue: 7 }],
    ['queue with non-integer entries', { ...validState, queue: [1, '2'] }],
    ['active not integer or null', { ...validState, active: '1' }],
    ['day in wrong format', { ...validState, day: '18-10-2026' }],
    ['day missing', (() => { const { day: _day, ...rest } = validState; return rest; })()],
  ])('rejects: %s', (_label, value) => {
    expect(parseStoredState(value)).toBeNull();
  });
});

describe('toDurations', () => {
  it('passes through valid tuples', () => {
    expect(toDurations([25, 5, 15])).toEqual({ work: 25, short: 5, long: 15 });
  });

  it('clamps into the desktop spinbox ranges [1..60, 1..30, 1..60]', () => {
    expect(toDurations([0, 10, 99])).toEqual({ work: 1, short: 10, long: 60 });
    expect(toDurations([-4, 45, 15])).toEqual({ work: 1, short: 30, long: 15 });
    expect(toDurations([75, 0, 1])).toEqual({ work: 60, short: 1, long: 1 });
  });
});
