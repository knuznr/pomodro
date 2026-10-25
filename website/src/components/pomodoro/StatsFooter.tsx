import { CircleAlert, Flame } from 'lucide-react';
import { useI18n } from '@/lib/i18n.tsx';

interface StatsFooterProps {
  completedToday: number;
  warning: boolean;
}

export function StatsFooter({ completedToday, warning }: StatsFooterProps) {
  const { t } = useI18n();
  return (
    <footer className="flex flex-col gap-2 text-xs text-text-muted">
      <span className="inline-flex items-center gap-2 self-center rounded-full border border-border bg-surface px-3 py-1.5">
        <Flame className="size-3.5 text-amber-400" aria-hidden="true" />
        {t('stats', { n: completedToday })}
      </span>
      {warning && (
        <span role="status" className="inline-flex items-center justify-center gap-1.5 text-amber-400">
          <CircleAlert className="size-3.5" aria-hidden="true" />
          {t('storage_save_warning')}
        </span>
      )}
    </footer>
  );
}
