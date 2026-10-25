import { useState } from 'react';
import { ChevronDown, Play, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, Switch } from '@/components/ui/form';
import { NumberStepper } from '@/components/ui/number-stepper';
import { SettingsRow } from '@/components/pomodoro/SettingsRow';
import { useI18n } from '@/lib/i18n.tsx';
import { GOAL_RANGE, SOUNDS, type Prefs, type Sound } from '@/lib/prefs';
import type { Durations } from '@/lib/types';

interface PreferencesCardProps {
  prefs: Prefs;
  onChange: (patch: Partial<Prefs>) => void;
  onPreview: (sound: Sound) => void;
  durations: Durations;
  onDurations: (next: Durations) => void;
}

export function PreferencesCard({ prefs, onChange, onPreview, durations, onDurations }: PreferencesCardProps) {
  const { t } = useI18n();
  const [blocked, setBlocked] = useState(false);

  const toggleNotifications = async (on: boolean) => {
    setBlocked(false);
    if (!on) return onChange({ notifications: false });
    if (typeof Notification === 'undefined') return setBlocked(true);
    const result =
      Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (result === 'granted') onChange({ notifications: true });
    else setBlocked(true);
  };

  return (
    <Card>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-xs font-semibold text-text-secondary [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          <h2>{t('prefs_title')}</h2>
          <ChevronDown
            className="ml-auto size-3.5 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <CardContent className="flex flex-col gap-4 px-4 pb-4 pt-0">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-text-primary">{t('pref_goal')}</span>
            <NumberStepper
              value={prefs.goal}
              min={GOAL_RANGE.min}
              max={GOAL_RANGE.max}
              onChange={(goal) => onChange({ goal })}
              decreaseLabel={t('decrease')}
              increaseLabel={t('increase')}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="pref-sound" className="text-xs font-medium text-text-primary">
              {t('pref_sound')}
            </label>
            <div className="flex items-center gap-2">
              <div className="w-36">
                <Select
                  id="pref-sound"
                  value={prefs.sound}
                  onChange={(event) => {
                    const sound = event.target.value as Sound;
                    onChange({ sound });
                    onPreview(sound);
                  }}
                  options={SOUNDS.map((value) => ({
                    value,
                    label: t(`pref_sound_${value}`),
                  }))}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-10"
                aria-label={t('pref_sound')}
                disabled={prefs.sound === 'off'}
                onClick={() => onPreview(prefs.sound)}
              >
                <Play className="size-3.5" />
              </Button>
            </div>
          </div>
          <Switch
            label={t('pref_auto_break')}
            description={t('pref_auto_break_hint')}
            checked={prefs.autoBreak}
            onChange={(autoBreak) => onChange({ autoBreak })}
          />
          <Switch
            label={t('pref_auto_work')}
            description={t('pref_auto_work_hint')}
            checked={prefs.autoWork}
            onChange={(autoWork) => onChange({ autoWork })}
          />
          <Switch
            label={t('pref_notifications')}
            description={blocked ? t('pref_notifications_blocked') : t('pref_notifications_hint')}
            checked={prefs.notifications}
            onChange={(on) => void toggleNotifications(on)}
          />
          <div className="border-t border-border pt-4">
            <SettingsRow durations={durations} onChange={onDurations} />
          </div>
        </CardContent>
      </details>
    </Card>
  );
}
