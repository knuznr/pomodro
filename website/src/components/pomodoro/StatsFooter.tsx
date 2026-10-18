import { useI18n } from '@/lib/i18n.tsx';

interface StatsFooterProps {
  completedToday: number;
  warning: boolean;
}

export function StatsFooter({ completedToday, warning }: StatsFooterProps) {
  const { t } = useI18n();
  return (
    <footer className="flex flex-col gap-1 text-xs text-text-muted">
      <span>{t('stats', { n: completedToday })}</span>
      {warning && <span role="status">{t('storage_save_warning')}</span>}
    </footer>
  );
}
