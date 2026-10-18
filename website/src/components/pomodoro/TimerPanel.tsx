import { AnimatedNumber } from '@/components/ui/animated-number';
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
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6">
      <Badge variant="soft" tone={BADGE_TONES[phase]}>{t(STATUS_KEYS[phase])}</Badge>
      <div className="flex items-baseline font-mono text-6xl tabular-nums text-text-primary">
        <AnimatedNumber value={minutes} pad={2} useGrouping={false} />
        <span>:</span>
        <AnimatedNumber value={seconds} pad={2} useGrouping={false} />
      </div>
      <div data-testid="progress" className="h-[3px] w-full overflow-hidden rounded bg-border">
        <div className="h-full bg-text-primary" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-text-muted">{t('session_counter', { n: cyclePosition })}</p>
      <div data-testid="session-marks" className="flex gap-2 text-lg tracking-widest text-text-secondary">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} data-mark={index < cyclePosition ? 'filled' : 'empty'}>
            {index < cyclePosition ? '●' : '○'}
          </span>
        ))}
      </div>
    </section>
  );
}
