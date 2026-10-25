import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n.tsx';

interface ControlsRowProps {
  running: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip?: () => void;
  onExtend?: (minutes: number) => void;
}

export function ControlsRow({ running, onStart, onPause, onReset, onSkip, onExtend }: ControlsRowProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
    <div className="flex gap-3">
      <Button variant="primary" size="lg" disabled={running} onClick={onStart} className="min-w-0 flex-[1.4] px-3" leftIcon={<Play className="size-4 fill-current" />} aria-keyshortcuts="Space">
        {t('start')}
      </Button>
      <Button variant="secondary" size="lg" disabled={!running} onClick={onPause} className="min-w-0 flex-1 px-3" leftIcon={<Pause className="size-4" />} aria-keyshortcuts="Space">
        {t('pause')}
      </Button>
      <Button variant="secondary" size="lg" onClick={onReset} className="min-w-0 flex-1 px-3" leftIcon={<RotateCcw className="size-4" />} aria-keyshortcuts="R">
        {t('reset')}
      </Button>
    </div>
    {(onSkip || onExtend) && (
      <div className="flex justify-center gap-1">
        {onSkip && (
          <Button variant="ghost" size="sm" className="px-2 text-text-secondary hover:text-text-primary" onClick={onSkip} leftIcon={<SkipForward className="size-3.5" />}>{t('skip')}</Button>
        )}
        {onExtend && (
          <>
            <Button variant="ghost" size="sm" className="px-2 text-text-secondary hover:text-text-primary" onClick={() => onExtend(1)}>{t('extend_1')}</Button>
            <Button variant="ghost" size="sm" className="px-2 text-text-secondary hover:text-text-primary" onClick={() => onExtend(5)}>{t('extend_5')}</Button>
          </>
        )}
      </div>
    )}
    </div>
  );
}
