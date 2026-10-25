import { AnimatedNumber } from '@/components/ui/animated-number';
import { Card } from '@/components/ui/card';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n.tsx';
import type { Phase } from '@/lib/types';
import type { StringKey } from '@/lib/i18n';

interface TimerPanelProps {
  phase: Phase;
  timeLeft: number;
  pomodoroCount: number;
  progress: number;
}

const STATUS_KEYS: Record<Phase, StringKey> = {
  work: 'status_work',
  short: 'status_short',
  long: 'status_long',
};

const RING_TONES: Record<Phase, string> = {
  work: 'text-text-primary',
  short: 'text-emerald-400',
  long: 'text-amber-400',
};

const BADGE_TONES: Record<Phase, 'neutral' | 'success' | 'warning'> = {
  work: 'neutral',
  short: 'success',
  long: 'warning',
};

export function TimerPanel({ phase, timeLeft, pomodoroCount, progress }: TimerPanelProps) {
  const { t } = useI18n();
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const cyclePosition = pomodoroCount === 0 ? 0 : ((pomodoroCount - 1) % 4) + 1;
  return (
    <Card className="flex flex-col items-center gap-5 bg-gradient-to-b from-surface to-surface-raised px-6 py-8">
      <ProgressRing value={progress} className={RING_TONES[phase]}>
        <div className="flex items-baseline font-mono text-6xl font-medium tabular-nums tracking-tight text-text-primary">
          <AnimatedNumber value={minutes} pad={2} useGrouping={false} />
          <span className="px-0.5 text-text-muted">:</span>
          <AnimatedNumber value={seconds} pad={2} useGrouping={false} />
        </div>
        <Badge variant="soft" tone={BADGE_TONES[phase]} dot className="mt-3">
          {t(STATUS_KEYS[phase])}
        </Badge>
      </ProgressRing>
      <div className="flex flex-col items-center gap-2">
        <div data-testid="session-marks" className="flex gap-2">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              data-mark={index < cyclePosition ? 'filled' : 'empty'}
              className={`h-1.5 w-8 rounded-full transition-colors duration-300 ${
                index < cyclePosition ? 'bg-text-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-text-muted">{t('session_counter', { n: cyclePosition })}</p>
      </div>
    </Card>
  );
}
