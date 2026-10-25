import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { useI18n } from '@/lib/i18n.tsx';
import type { Phase } from '@/lib/types';

interface PhaseTabsProps {
  phase: Phase;
  running: boolean;
  onSelect: (phase: Phase) => void;
}

/** Manual phase switch; locked while the clock runs so a stray click can't drop progress. */
export function PhaseTabs({ phase, running, onSelect }: PhaseTabsProps) {
  const { t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t('phase_tabs')}
      className={`flex justify-center transition-opacity ${running ? 'pointer-events-none opacity-50' : ''}`}
    >
      <AnimatedTabs
        variant="pill"
        tabs={[
          { id: 'work', label: t('settings_work') },
          { id: 'short', label: t('settings_short') },
          { id: 'long', label: t('settings_long') },
        ]}
        activeTab={phase}
        onChange={(id) => onSelect(id as Phase)}
        renderContent={false}
      />
    </div>
  );
}
