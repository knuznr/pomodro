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

/** Two-tone chime: 880 Hz then 660 Hz, 150 ms each (desktop beep parity). */
export function playChime(): void {
  if (!audioContext) {
    return;
  }
  const ctx = audioContext;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  const startAt = ctx.currentTime;
  [880, 660].forEach((frequency, index) => {
    const at = startAt + index * 0.15;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.16);
  });
}
