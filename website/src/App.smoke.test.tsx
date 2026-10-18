import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App smoke', () => {
  it('mounts with the default storage path and renders the idle 25:00 timer', async () => {
    // Placeholder-era scaffold test rewritten for the wired, async app:
    // findBy* settles the hydration commit batch (the old sync assertion
    // fired inside unflushed state updates and emitted 8 act() warnings per
    // suite run). No storage prop → the lazy default decision runs for real,
    // and jsdom (no IndexedDB) exercises the §11 memory fallback end-to-end.
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
    // Status badge (work = neutral tone), padded mm:ss on the clock.
    expect(screen.getByText('Focus time')).toBeInTheDocument();
    expect(document.querySelector('[aria-label="25"]')).toBeInTheDocument();
    expect(document.querySelector('[aria-label="00"]')).toBeInTheDocument();
    // 4 session marks, all empty at pomodoroCount 0 — the app did not crash.
    const marks = screen.getByTestId('session-marks');
    expect(marks.querySelectorAll('[data-mark="filled"]')).toHaveLength(0);
    expect(marks.querySelectorAll('[data-mark="empty"]')).toHaveLength(4);
  });
});
