import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n.tsx';

interface ControlsRowProps {
  running: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

export function ControlsRow({ running, onStart, onPause, onReset }: ControlsRowProps) {
  const { t } = useI18n();
  return (
    <div className="flex gap-3">
      <Button variant="primary" size="lg" disabled={running} onClick={onStart} className="flex-1">
        {t('start')}
      </Button>
      <Button variant="secondary" size="lg" disabled={!running} onClick={onPause} className="flex-1">
        {t('pause')}
      </Button>
      <Button variant="secondary" size="lg" onClick={onReset} className="flex-1">
        {t('reset')}
      </Button>
    </div>
  );
}
