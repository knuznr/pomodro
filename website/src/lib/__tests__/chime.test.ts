import { describe, expect, it, vi } from 'vitest';
import { ensureChime, playChime } from '../chime';

describe('chime', () => {
  it('no-ops safely in environments without AudioContext (jsdom)', () => {
    expect(() => {
      ensureChime();
      playChime();
    }).not.toThrow();
  });

  it('schedules overlapping notes per sound, silent for off, and keeps summed peaks under 1', () => {
    let oscillators = 0;
    const peaks: number[] = [];
    const param = (record?: boolean) => ({
      value: 0,
      setValueAtTime: () => {},
      exponentialRampToValueAtTime: (v: number) => {
        if (record) peaks.push(v);
      },
    });
    class FakeContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      createOscillator = () => (oscillators++, { type: '', frequency: param(), connect: () => {}, start: () => {}, stop: () => {} });
      createGain = () => ({ gain: param(true), connect: () => {} });
    }
    vi.stubGlobal('AudioContext', FakeContext);
    Object.defineProperty(window, 'AudioContext', { value: FakeContext, configurable: true });
    ensureChime();
    playChime('off');
    expect(oscillators).toBe(0);
    for (const sound of ['chime', 'bell', 'soft'] as const) {
      oscillators = 0;
      peaks.length = 0;
      playChime(sound);
      expect(oscillators).toBeGreaterThanOrEqual(4);
      expect(Math.max(...peaks)).toBeLessThan(0.25);
      expect(peaks.reduce((a, b) => a + b, 0) / 2).toBeLessThan(1);
    }
    vi.unstubAllGlobals();
  });
});
