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

  it('parses the empty record with every desktop default', () => {
    expect(parseStoredState({})).toEqual({
      tasks: [],
      next_id: 1,
      queue: [],
      active: null,
      durations: [25, 5, 15],
      day: '',
      completed: 0,
    });
  });

  it('fills the defaults around a partial record', () => {
    const parsed = parseStoredState({ tasks: [{ id: 3, title: 'X', completed: false }] });
    expect(parsed?.tasks).toEqual([{ id: 3, title: 'X', completed: false }]);
    expect(parsed?.next_id).toBe(4);
    expect(parsed?.queue).toEqual([]);
    expect(parsed?.active).toBeNull();
    expect(parsed?.durations).toEqual([25, 5, 15]);
    expect(parsed?.day).toBe('');
    expect(parsed?.completed).toBe(0);
  });

  it('coerces next_id with Python int() semantics', () => {
    expect(parseStoredState({ ...validState, next_id: ' 2 ' })?.next_id).toBe(2);
    expect(parseStoredState({ ...validState, next_id: '2' })?.next_id).toBe(2);
    expect(parseStoredState({ ...validState, next_id: 1.5 })?.next_id).toBe(2);
    expect(
      parseStoredState({
        ...validState,
        next_id: 1.5,
        tasks: [{ id: 5, title: 'Eski', completed: false }],
      })?.next_id,
    ).toBe(6);
  });

  it('coerces and clamps completed with Python int() semantics', () => {
    expect(parseStoredState({ ...validState, completed: '7' })?.completed).toBe(7);
    expect(parseStoredState({ ...validState, completed: -5 })?.completed).toBe(0);
    expect(parseStoredState({ ...validState, completed: 1.5 })?.completed).toBe(1);
    expect(parseStoredState({ ...validState, completed: true })?.completed).toBe(1);
  });

  it('never validates day — a bad/missing day only yields an empty marker', () => {
    expect(parseStoredState({ ...validState, day: 123 })?.day).toBe('');
    expect(parseStoredState({ ...validState, day: '18-10-2026' })?.day).toBe('18-10-2026');
    const { day: _day, ...missingDay } = validState;
    expect(parseStoredState(missingDay)?.day).toBe('');
    expect(parseStoredState(missingDay)?.tasks).toEqual(validState.tasks);
  });

  it.each([
    ['null input', null],
    ['string input', 'nope'],
    ['tasks not an array', { ...validState, tasks: {} }],
    ['task row not an object', { ...validState, tasks: ['x'] }],
    ['task row missing title', { ...validState, tasks: [{ id: 1, completed: false }] }],
    [
      'task row with extra key',
      { ...validState, tasks: [{ id: 1, title: 'x', completed: false, note: 'ek' }] },
    ],
    ['task id non-integer', { ...validState, tasks: [{ id: 1.5, title: 'x', completed: false }] }],
    ['task id below 1', { ...validState, tasks: [{ id: 0, title: 'x', completed: false }] }],
    ['task title not a string', { ...validState, tasks: [{ id: 1, title: 5, completed: false }] }],
    [
      'task completed not boolean',
      { ...validState, tasks: [{ id: 1, title: 'x', completed: 'no' }] },
    ],
    ['next_id float string', { ...validState, next_id: '2.5' }],
    ['next_id empty string', { ...validState, next_id: '' }],
    ['next_id null', { ...validState, next_id: null }],
    ['durations wrong length', { ...validState, durations: [25, 5] }],
    ['durations non-numeric', { ...validState, durations: [25, 'x', 15] }],
    ['durations not an array', { ...validState, durations: 'bad' }],
    ['queue not an array', { ...validState, queue: 7 }],
    ['queue with string entries', { ...validState, queue: [1, '2'] }],
    ['queue with float entries', { ...validState, queue: [1.5] }],
    ['active string', { ...validState, active: '1' }],
    ['active float', { ...validState, active: 1.5 }],
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
