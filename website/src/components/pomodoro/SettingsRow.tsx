import { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/form';
import { useI18n } from '@/lib/i18n.tsx';
import type { Durations } from '@/lib/types';

interface SettingsRowProps {
  durations: Durations;
  onChange: (next: Durations) => void;
}

const FIELDS = [
  { key: 'work', max: 60 },
  { key: 'short', max: 30 },
  { key: 'long', max: 60 },
] as const;

type DurationKey = (typeof FIELDS)[number]['key'];

export function SettingsRow({ durations, onChange }: SettingsRowProps) {
  const { t } = useI18n();
  // The App-owned durations state only lands back as a prop after each onChange;
  // merging successive edits would otherwise stale-spread the prop snapshot, so
  // track the latest emitted durations and re-sync to the prop on every commit.
  const latestRef = useRef(durations);
  // Number inputs are uncontrolled: React's controlled-input restore rewrites the
  // DOM value to the (lagging) prop while a burst of edits is in flight, which
  // corrupts the in-progress value/caret (e.g. typing '3' into a restored '25'
  // parses as 325). Sync the visible values from the durations prop instead,
  // skipping the field that is currently being typed into.
  const inputRefs = useRef<Partial<Record<DurationKey, HTMLInputElement | null>>>({});

  useEffect(() => {
    latestRef.current = durations;
    for (const field of FIELDS) {
      const el = inputRefs.current[field.key];
      if (el && document.activeElement !== el && el.value !== String(durations[field.key])) {
        el.value = String(durations[field.key]);
      }
    }
  }, [durations]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-xs font-semibold text-text-secondary">{t('settings_title')}</h2>
      <div className="grid grid-cols-3 gap-3">
        {FIELDS.map((field) => {
          const labelKey = field.key === 'work'
            ? 'settings_work'
            : field.key === 'short'
              ? 'settings_short'
              : 'settings_long';
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <label htmlFor={`duration-${field.key}`} className="text-xs text-text-muted">
                {t(labelKey)}
              </label>
              <Input
                ref={(el) => { inputRefs.current[field.key] = el; }}
                id={`duration-${field.key}`}
                name={`duration-${field.key}`}
                type="number"
                min={1}
                max={field.max}
                step={1}
                defaultValue={durations[field.key]}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  const clamped = Number.isNaN(parsed)
                    ? 1
                    : Math.min(field.max, Math.max(1, parsed));
                  const next: Durations = { ...latestRef.current, [field.key]: clamped };
                  latestRef.current = next;
                  onChange(next);
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
