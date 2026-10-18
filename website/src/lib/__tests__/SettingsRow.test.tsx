import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsRow } from '@/components/pomodoro/SettingsRow';
import { I18nProvider } from '@/lib/i18n.tsx';

function renderSettings(onChange = vi.fn()) {
  render(
    <I18nProvider lang="tr" setLang={() => {}}>
      <SettingsRow durations={{ work: 25, short: 5, long: 15 }} onChange={onChange} />
    </I18nProvider>,
  );
  return onChange;
}

describe('SettingsRow', () => {
  it('renders the group title and the three labelled inputs', () => {
    renderSettings();
    expect(screen.getByText('Seans süreleri · dakika')).toBeInTheDocument();
    expect(screen.getByLabelText('Çalışma')).toBeInTheDocument();
    expect(screen.getByLabelText('Kısa mola')).toBeInTheDocument();
    expect(screen.getByLabelText('Uzun mola')).toBeInTheDocument();
    expect(screen.getByLabelText('Çalışma')).toHaveValue(25);
  });

  it('emits clamped durations on change', async () => {
    const user = userEvent.setup();
    const onChange = renderSettings();
    await user.clear(screen.getByLabelText('Çalışma'));
    await user.type(screen.getByLabelText('Çalışma'), '30');
    expect(onChange).toHaveBeenLastCalledWith({ work: 30, short: 5, long: 15 });
    await user.clear(screen.getByLabelText('Çalışma'));
    await user.type(screen.getByLabelText('Çalışma'), '99');
    expect(onChange).toHaveBeenLastCalledWith({ work: 60, short: 5, long: 15 });
    await user.clear(screen.getByLabelText('Kısa mola'));
    await user.type(screen.getByLabelText('Kısa mola'), '0');
    expect(onChange).toHaveBeenLastCalledWith({ work: 60, short: 1, long: 15 });
  });
});
