import type { Sound } from './prefs';

let audioContext: AudioContext | null = null;

/** Create the AudioContext inside a user gesture (browser autoplay policy). */
export function ensureChime(): void {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') {
    return;
  }
  if (audioContext === null) {
    try {
      audioContext = new AudioContext();
    } catch {
      audioContext = null;
    }
  }
}

interface SoundSpec {
  /** [frequency ratio, relative gain] — overtones stacked on each note. */
  partials: [number, number][];
  /** [frequency Hz, start offset s, decay s, peak gain] — notes overlap and ring out. */
  notes: [number, number, number, number][];
}

const SOUNDS: Record<Exclude<Sound, 'off'>, SoundSpec> = {
  // Desktop beep parity (880 Hz then 660 Hz), warmed with an octave overtone.
  chime: { partials: [[1, 1], [2, 0.25]], notes: [[880, 0, 0.6, 0.2], [660, 0.18, 0.8, 0.2]] },
  // Inharmonic overtones give the metallic bell strike.
  bell: { partials: [[1, 1], [2.76, 0.4], [5.4, 0.15]], notes: [[1320, 0, 1.6, 0.16], [990, 0.28, 1.8, 0.14]] },
  // Gentle rising C–E–G, each note blooming into the next.
  soft: { partials: [[1, 1], [2, 0.12]], notes: [[523, 0, 0.9, 0.13], [659, 0.22, 0.9, 0.13], [784, 0.44, 1.2, 0.13]] },
};

export function playChime(sound: Sound = 'chime'): void {
  if (!audioContext || sound === 'off') {
    return;
  }
  const ctx = audioContext;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  const start = ctx.currentTime;
  const { partials, notes } = SOUNDS[sound];
  for (const [frequency, offset, decay, peak] of notes) {
    const at = start + offset;
    for (const [ratio, level] of partials) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * ratio;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak * level, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay / ratio ** 0.5);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + decay + 0.05);
    }
  }
}
