import { useEffect, useRef } from 'react';
import { Minus, Plus, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  const emit = (key: DurationKey, max: number, value: number) => {
    const next: Durations = { ...latestRef.current, [key]: Math.min(max, Math.max(1, value)) };
    latestRef.current = next;
    onChange(next);
  };

  const step = (key: DurationKey, max: number, delta: number) => {
    const el = inputRefs.current[key];
    const value = Math.min(max, Math.max(1, latestRef.current[key] + delta));
    if (el) el.value = String(value);
    emit(key, max, value);
  };

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
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-secondary">
        <Timer className="size-3.5" aria-hidden="true" />
        {t('settings_title')}
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {FIELDS.map((field) => {
          const labelKey = field.key === 'work'
            ? 'settings_work'
            : field.key === 'short'
              ? 'settings_short'
              : 'settings_long';
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <label htmlFor={`duration-${field.key}`} className="text-xs font-medium text-text-muted">
                {t(labelKey)}
              </label>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-8 shrink-0" tabIndex={-1} aria-label={`${t('decrease')} — ${t(labelKey)}`} onClick={() => step(field.key, field.max, -1)}>
                  <Minus className="size-3.5" />
                </Button>
                <Input
                  ref={(el) => { inputRefs.current[field.key] = el; }}
                  id={`duration-${field.key}`}
                  name={`duration-${field.key}`}
                  type="number"
                  min={1}
                  max={field.max}
                  step={1}
                  defaultValue={durations[field.key]}
                  className="px-1 text-center font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    emit(field.key, field.max, Number.isNaN(parsed) ? 1 : parsed);
                  }}
                />
                <Button variant="ghost" size="icon" className="size-8 shrink-0" tabIndex={-1} aria-label={`${t('increase')} — ${t(labelKey)}`} onClick={() => step(field.key, field.max, 1)}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
