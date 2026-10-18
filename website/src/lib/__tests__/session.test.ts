import { describe, expect, it } from 'vitest';
import { InvalidSessionCountError, nextBreak } from '../session';

describe('nextBreak', () => {
  it.each([
    [1, 'short'],
    [2, 'short'],
    [3, 'short'],
    [4, 'long'],
    [5, 'short'],
    [6, 'short'],
    [8, 'long'],
    [10, 'short'],
    [12, 'long'],
  ] as const)('after %i completed sessions the next break is %j', (completed, expected) => {
    expect(nextBreak(completed)).toBe(expected);
  });

  it.each([0, -1])('throws InvalidSessionCountError for %i', (completed) => {
    expect(() => nextBreak(completed)).toThrow(InvalidSessionCountError);
  });
});
