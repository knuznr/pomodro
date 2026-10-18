import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ControlsRow } from '@/components/pomodoro/ControlsRow';
import { I18nProvider } from '@/lib/i18n.tsx';

function renderControls(ui: React.ReactElement) {
  return render(<I18nProvider lang="tr" setLang={() => {}}>{ui}</I18nProvider>);
}

describe('ControlsRow', () => {
  it('disables Start and enables Pause while running', () => {
    renderControls(<ControlsRow running onStart={() => {}} onPause={() => {}} onReset={() => {}} />);
    expect(screen.getByRole('button', { name: 'Başlat' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Duraklat' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Sıfırla' })).toBeEnabled();
  });

  it('disables Pause when idle and wires the handlers', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const onPause = vi.fn();
    const onReset = vi.fn();
    renderControls(<ControlsRow running={false} onStart={onStart} onPause={onPause} onReset={onReset} />);
    expect(screen.getByRole('button', { name: 'Duraklat' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Başlat' }));
    await user.click(screen.getByRole('button', { name: 'Sıfırla' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onPause).not.toHaveBeenCalled();
  });
});
