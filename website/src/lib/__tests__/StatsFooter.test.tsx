import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatsFooter } from '@/components/pomodoro/StatsFooter';
import { I18nProvider } from '@/lib/i18n.tsx';

function renderFooter(ui: React.ReactElement) {
  return render(<I18nProvider lang="tr" setLang={() => {}}>{ui}</I18nProvider>);
}

describe('StatsFooter', () => {
  it('shows the completed-today count', () => {
    renderFooter(<StatsFooter completedToday={3} warning={false} />);
    expect(screen.getByText('Bugün tamamlanan: 3')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a save warning when persistence fails', () => {
    renderFooter(<StatsFooter completedToday={0} warning={true} />);
    expect(screen.getByRole('status')).toHaveTextContent('Ayarlar kaydedilemedi');
  });
});
