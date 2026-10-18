import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UndoToast } from '@/components/ui/undo-toast';

/**
 * Runbook item 7's "5 s countdown": the undo toast must drain its
 * progress bar and auto-dismiss itself at the end of the window, so a
 * stale "task deleted" notice can never sweep an undo under a finished
 * timer. Fake Date + rAF (real timers elsewhere) drive the component's
 * frame loop without fighting framer-motion or RTL.
 */
describe('UndoToast', () => {
  it('drains the countdown bar and auto-dismisses exactly after 5 s', () => {
    vi.useFakeTimers({
      toFake: ['Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    try {
      const onDismiss = vi.fn();
      const { getByText, container } = render(
        <UndoToast
          open
          title="Görev silindi"
          undoLabel="Geri al"
          duration={5000}
          position="bottom-right"
          onDismiss={onDismiss}
        />,
      );

      expect(getByText('Görev silindi')).toBeInTheDocument();
      expect(onDismiss).not.toHaveBeenCalled();

      // The progress bar drains with elapsed time (bar inner node is the
      // only styled one carrying an inline width).
      act(() => {
        vi.advanceTimersByTime(1250); // a quarter of the window
      });
      const bar = Array.from(container.querySelectorAll<HTMLElement>('[style]')).find((node) =>
        node.getAttribute('style')?.includes('width'),
      );
      expect(bar).not.toBeNull();
      expect(Number.parseFloat(bar!.style.width.replace('%', ''))).toBeLessThan(90);
      expect(onDismiss).not.toHaveBeenCalled();

      // And it stays up while the window is open…
      expect(getByText('Görev silindi')).toBeInTheDocument();

      // …then the 5 s window expires: the toast dismisses itself once.
      act(() => {
        vi.advanceTimersByTime(3850); // now past 5100 ms total
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
