import { Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n.tsx';
import { lastDays } from '@/lib/prefs';

interface StatsCardProps {
  today: string;
  completedToday: number;
  goal: number;
  history: Record<string, number>;
}

export function StatsCard({ today, completedToday, goal, history }: StatsCardProps) {
  const { t, lang } = useI18n();
  const days = lastDays(today, 7).map((day) => ({
    day,
    count: day === today ? completedToday : (history[day] ?? 0),
  }));
  const top = Math.max(goal, ...days.map((d) => d.count));
  const emptyWeek = days.every((d) => d.count === 0);
  const met = completedToday >= goal;
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'narrow' });
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold text-text-secondary">{t('week_title')}</h2>
          <span className={`inline-flex items-center gap-1.5 text-xs ${met ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-muted'}`}>
            {met && <Trophy className="size-3.5" aria-hidden="true" />}
            {met ? t('goal_met') : t('goal_progress', { n: completedToday, goal })}
          </span>
        </div>
        {emptyWeek ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-text-muted">
            {t('week_empty_hint')}
          </p>
        ) : (
          <div className="flex h-20 items-end gap-2" role="img" aria-label={days.map((d) => d.count).join(', ')}>
            {days.map(({ day, count }) => {
              const isToday = day === today;
              const [y, m, d] = day.split('-').map(Number);
              return (
                <div key={day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${day}: ${count}`}>
                  <div
                    className={`w-full rounded-md transition-[height] duration-500 ${
                      isToday ? 'bg-text-primary' : 'bg-border-hover'
                    } ${count === 0 ? 'opacity-40' : ''}`}
                    style={{ height: `${Math.max(6, (count / top) * 100)}%` }}
                  />
                  <span className={`text-[10px] ${isToday ? 'text-text-primary' : 'text-text-muted'}`}>
                    {weekday.format(new Date(y, m - 1, d))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
