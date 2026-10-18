import { AnimatedTabs } from '@/components/ui/animated-tabs';
import type { Lang } from '@/lib/types';

interface LanguageToggleProps {
  lang: Lang;
  onChange: (lang: Lang) => void;
}

export function LanguageToggle({ lang, onChange }: LanguageToggleProps) {
  return (
    <AnimatedTabs
      variant="pill"
      tabs={[
        { id: 'tr', label: 'TR' },
        { id: 'en', label: 'EN' },
      ]}
      activeTab={lang}
      onChange={(id) => onChange(id as Lang)}
      renderContent={false}
    />
  );
}
