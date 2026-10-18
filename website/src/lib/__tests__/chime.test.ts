import { describe, expect, it } from 'vitest';
import { ensureChime, playChime } from '../chime';

describe('chime', () => {
  it('no-ops safely in environments without AudioContext (jsdom)', () => {
    expect(() => {
      ensureChime();
      playChime();
    }).not.toThrow();
  });
});
