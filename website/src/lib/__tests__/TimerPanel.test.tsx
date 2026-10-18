import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimerPanel } from '@/components/pomodoro/TimerPanel';
import { I18nProvider } from '@/lib/i18n.tsx';

function renderTimer(ui: React.ReactElement) {
  return render(<I18nProvider lang="tr" setLang={() => {}}>{ui}</I18nProvider>);
}

describe('TimerPanel', () => {
  it('shows the work status badge and a padded mm:ss display', () => {
    const { container } = renderTimer(
      <TimerPanel phase="work" timeLeft={1500} pomodoroCount={0} progress={100} />,
    );
    expect(screen.getByText('Çalışma zamanı')).toBeInTheDocument();
    const labels = [...container.querySelectorAll('[aria-label]')].map((node) =>
      node.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['25', '00']);
    expect(container.textContent).toContain('Oturum 0/4');
  });

  it('drains the progress bar from the top', () => {
    const { container } = renderTimer(
      <TimerPanel phase="short" timeLeft={150} pomodoroCount={1} progress={50} />,
    );
    expect(screen.getByText('Kısa mola zamanı')).toBeInTheDocument();
    const fill = container.querySelector('[data-testid="progress"] > div') as HTMLElement;
    expect(fill.style.width).toBe('50%');
    expect(container.textContent).toContain('Oturum 1/4');
  });

  it('fills session marks on the (count-1)%4+1 desktop cycle', () => {
    const { container } = renderTimer(
      <TimerPanel phase="long" timeLeft={900} pomodoroCount={4} progress={100} />,
    );
    expect(screen.getByText('Uzun mola zamanı')).toBeInTheDocument();
    const marks = container.querySelectorAll('[data-testid="session-marks"] [data-mark]');
    expect(marks).toHaveLength(4);
    expect(marks[0].getAttribute('data-mark')).toBe('filled');
    expect(marks[3].getAttribute('data-mark')).toBe('filled');
    expect(container.textContent).toContain('Oturum 4/4');
  });

  it('shows zero marks and 0/4 before the first completed session', () => {
    const { container } = renderTimer(
      <TimerPanel phase="work" timeLeft={1500} pomodoroCount={0} progress={100} />,
    );
    const marks = container.querySelectorAll('[data-testid="session-marks"] [data-mark]');
    expect([...marks].every((mark) => mark.getAttribute('data-mark') === 'empty')).toBe(true);
  });
});
