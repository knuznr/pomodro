import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { VelocityToast } from '@/components/ui/velocity-toast';
import { ControlsRow } from '@/components/pomodoro/ControlsRow';
import { LanguageToggle } from '@/components/pomodoro/LanguageToggle';
import { SettingsRow } from '@/components/pomodoro/SettingsRow';
import { StatsFooter } from '@/components/pomodoro/StatsFooter';
import { TaskSection } from '@/components/pomodoro/TaskSection';
import { TimerPanel } from '@/components/pomodoro/TimerPanel';
import { ensureChime, playChime } from '@/lib/chime';
import { createIndexedDbStorage } from '@/lib/indexedDbStorage';
import { createMemoryStorage } from '@/lib/memoryStorage';
// Project rule: context APIs come from './i18n.tsx'; pure i18n helpers from './i18n'.
import { detectLang, translate } from '@/lib/i18n';
import { I18nProvider, useI18n } from '@/lib/i18n.tsx';
import { FocusQueue } from '@/lib/focusQueue';
import { EmptyTitleError, TaskStore } from '@/lib/tasks';
import { parseStoredState, toDurations, type PomodoroStorage } from '@/lib/storage';
import { localIsoDate, TimerEngine, type TimerSnapshot } from '@/lib/timer';
import {
  DEFAULT_DURATIONS,
  type Durations,
  type Lang,
  type Phase,
  type StoredState,
} from '@/lib/types';

interface PomodoroAppProps {
  storage?: PomodoroStorage;
}

/**
 * Gated + memoized default storage. `createIndexedDbStorage`'s `= indexedDB`
 * default parameter would throw a ReferenceError where the global is absent
 * (jsdom, hardened private modes), so the decision is guarded with `typeof`
 * and only evaluated on first render — never at module import.
 */
let defaultStorage: PomodoroStorage | null = null;
function getDefaultStorage(): PomodoroStorage {
  if (!defaultStorage) {
    defaultStorage = typeof indexedDB !== 'undefined' ? createIndexedDbStorage() : createMemoryStorage();
  }
  return defaultStorage;
}

const TICK_MS = 200;
const TOAST_MS = 5000;

/**
 * Session-end toast; `kind` is the phase that just ENDED — desktop wording
 * parity (app.py show_notification): a work session that ended announces
 * "Çalışma tamamlandı" (work strings), a finished break announces "Mola bitti".
 */
function PhaseToast({ kind, onDismiss }: { kind: 'work' | 'break' | null; onDismiss: () => void }) {
  const { t } = useI18n();
  return (
    <VelocityToast
      open={kind !== null}
      onDismiss={onDismiss}
      duration={TOAST_MS}
      variant={kind === 'break' ? 'info' : 'success'}
      title={kind === 'break' ? t('toast_break_title') : t('toast_work_title')}
      description={kind === 'break' ? t('toast_break_description') : t('toast_work_description')}
    />
  );
}

export default function PomodoroApp({ storage = getDefaultStorage() }: PomodoroAppProps) {
  const storeRef = useRef(new TaskStore());
  const queueRef = useRef(new FocusQueue(storeRef.current));
  const durationsRef = useRef<Durations>(DEFAULT_DURATIONS);
  const activeIdRef = useRef<number | null>(null);
  const storageRef = useRef<PomodoroStorage>(storage);
  const engineRef = useRef<TimerEngine | null>(null);
  // Id of the pending phase-end toast belt timeout; it is re-armed at every
  // phase end and must never outlive the unmounted App.
  const toastTimerRef = useRef<number | null>(null);

  const [engine, setEngine] = useState<TimerEngine | null>(null);
  const [snap, setSnap] = useState<TimerSnapshot | null>(null);
  // The desktop speaks Turkish; hydration (saved choice, else navigator
  // detection) overrides. A rejected loadLang keeps this desktop default.
  const [lang, setLangState] = useState<Lang>('tr');
  const [storageError, setStorageError] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);
  const [pending, setPending] = useState<ReturnType<TaskStore['pending']>>([]);
  const [queuedIds, setQueuedIds] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [durations, setDurationsState] = useState<Durations>(DEFAULT_DURATIONS);
  const [phaseToastKind, setPhaseToastKind] = useState<'work' | 'break' | null>(null);

  /** Persist full state — same triggers as app.py save_state. */
  const persist = useCallback(() => {
    const engineInstance = engineRef.current;
    const activeStorage = storageRef.current;
    if (!engineInstance || !activeStorage) return;
    engineInstance.rolloverDay();
    const state: StoredState = {
      tasks: storeRef.current.all(),
      next_id: storeRef.current.next_id,
      queue: [...queueRef.current.queue],
      active: activeIdRef.current,
      durations: [
        durationsRef.current.work,
        durationsRef.current.short,
        durationsRef.current.long,
      ],
      day: engineInstance.currentDay(),
      completed: engineInstance.snapshot().completedToday,
    };
    // Desktop parity (app.py save_state with rollover_day relabeling the
    // footer before the status check): a SUCCESSFUL save clears an earlier
    // disk warning and a failure re-raises it. The load-error banner
    // (storageError) is independent — only the user's dismiss clears it.
    activeStorage.save(state)
      .then(() => setSaveWarning(false))
      .catch(() => setSaveWarning(true));
  }, []);

  const refresh = useCallback(() => {
    const store = storeRef.current;
    const list = store.pending();
    setPending(list);
    setQueuedIds(queueRef.current.pendingIds());
    setSelectedId((current) =>
      current !== null && list.some((task) => task.id === current) ? current : null,
    );
    const active = activeIdRef.current;
    if (active !== null) {
      try {
        if (store.get(active).completed) {
          activeIdRef.current = null;
        }
      } catch {
        activeIdRef.current = null; // removed from the store
      }
    }
  }, []);

  const handlePhaseEnd = useCallback(
    (nextPhase: Phase) => {
      playChime();
      // nextPhase is the phase the engine advanced TO — the toast announces
      // the one that just ENDED. The engine keeps the timer stopped (no
      // auto-start); we only celebrate + persist, desktop save_state parity.
      const kind: 'work' | 'break' = nextPhase === 'work' ? 'break' : 'work';
      setPhaseToastKind(kind);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setPhaseToastKind((current) => (current === kind ? null : current));
      }, TOAST_MS + 500);
      persist();
    },
    [persist],
  );

  /**
   * One-time load: hydrate the language, the stores and the engine from the
   * NoSQL storage. The language is awaited first (it belongs on the same
   * commit as the engine state) and a whole-storage failure keeps using the
   * same adapter for saves — the desktop keeps one QSettings instance too, so
   * every later save still surfaces the footer warning instead of passing
   * silently against a hot-swapped memory store.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let raw: unknown = null;
      let loadError = false;
      try {
        raw = await storage.load();
      } catch {
        loadError = true;
        raw = null;
      }
      if (cancelled) return;
      const saved = parseStoredState(raw);
      if (raw !== null && saved === null) loadError = true; // corrupted record

      let langValue: Lang = 'tr';
      try {
        const storedLang = await storage.loadLang();
        langValue = storedLang ?? detectLang();
      } catch {
        // storage broken — keep the desktop default below
      }
      if (cancelled) return;

      const store = storeRef.current;
      const today = localIsoDate();
      const savedDurations = saved ? toDurations(saved.durations) : DEFAULT_DURATIONS;

      if (saved) {
        store.load(saved.tasks, saved.next_id);
        for (const id of saved.queue) {
          try {
            if (!store.get(id).completed) {
              queueRef.current.enqueue(id);
            }
          } catch {
            continue; // stale id after reload — takeNext would skip it too
          }
        }
        activeIdRef.current = saved.active;
      }
      durationsRef.current = savedDurations;

      // Desktop rollover_day + `completed if day == today else 0` parity: the
      // engine always starts on TODAY and zeroed-completed records simply
      // count from 0; the previous day's tasks survive.
      const engineInstance = new TimerEngine(savedDurations, {
        completedToday: saved && saved.day === today ? saved.completed : 0,
        day: today,
        onPhaseEnd: handlePhaseEnd,
      });
      engineRef.current = engineInstance;

      // One batched commit: final language + engine + lists + banners.
      setLangState(langValue);
      setStorageError(loadError);
      setDurationsState(savedDurations);
      setEngine(engineInstance);
      setSnap(engineInstance.snapshot());
      refresh();
    })();
    return () => {
      cancelled = true;
    };
    // handlePhaseEnd is a stable useCallback; storage is an injected constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Desktop-accurate 200 ms heartbeat; the engine owns every rule. */
  useEffect(() => {
    if (!engine) return;
    const id = window.setInterval(() => {
      engine.tick();
      setSnap(engine.snapshot());
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [engine]);

  /** Belt timeout opened at phase end does not survive the unmounted App. */
  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    },
    [],
  );

  /** Save-on-hide safety net (desktop saves on window close). */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [persist]);

  const handleLang = useCallback((next: Lang) => {
    setLangState(next);
    void storageRef.current.saveLang(next).catch(() => setSaveWarning(true));
  }, []);

  const handleStart = useCallback(() => {
    ensureChime(); // inside the click gesture — autoplay policy
    engineRef.current?.start();
    if (engineRef.current) setSnap(engineRef.current.snapshot());
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pause();
    if (engineRef.current) setSnap(engineRef.current.snapshot());
  }, []);

  const handleReset = useCallback(() => {
    engineRef.current?.reset();
    if (engineRef.current) setSnap(engineRef.current.snapshot());
  }, []);

  const handleAdd = useCallback(
    (title: string): boolean => {
      try {
        storeRef.current.add(title);
      } catch (error) {
        if (error instanceof EmptyTitleError) return false;
        throw error;
      }
      refresh();
      persist();
      return true;
    },
    [refresh, persist],
  );

  const handleComplete = useCallback(() => {
    if (selectedId === null) return;
    try {
      storeRef.current.complete(selectedId);
    } catch {
      return;
    }
    refresh();
    persist();
  }, [selectedId, refresh, persist]);

  const handleDelete = useCallback(() => {
    if (selectedId === null) return;
    try {
      storeRef.current.remove(selectedId);
    } catch {
      return;
    }
    refresh();
    persist();
  }, [selectedId, refresh, persist]);

  /** Desktop "Geri al": blind undo — a no-op when nothing was deleted. */
  const handleUndo = useCallback(() => {
    storeRef.current.undoRemove();
    refresh();
    persist();
  }, [refresh, persist]);

  const handleQueue = useCallback(() => {
    if (selectedId === null) return;
    try {
      queueRef.current.enqueue(selectedId);
    } catch {
      return; // pending-list selections can't fail enqueue meaningfully
    }
    refresh();
    persist();
  }, [selectedId, refresh, persist]);

  const handleNext = useCallback(() => {
    const task = queueRef.current.takeNext();
    activeIdRef.current = task ? task.id : null;
    refresh();
    persist();
  }, [refresh, persist]);

  const handleDurations = useCallback(
    (next: Durations) => {
      durationsRef.current = next;
      setDurationsState(next);
      engineRef.current?.setDurations(next);
      const snapshot = engineRef.current?.snapshot();
      if (snapshot) setSnap(snapshot); // idle edit shows immediately (update_work_time parity)
      persist();
    },
    [persist],
  );

  if (!engine || !snap) {
    return <div className="min-h-screen bg-[var(--bg)]" data-testid="app-root" />;
  }

  const activeTitle = (() => {
    if (activeIdRef.current === null) return null;
    try {
      return storeRef.current.get(activeIdRef.current).title;
    } catch {
      return null;
    }
  })();

  return (
    <I18nProvider lang={lang} setLang={handleLang}>
      <div
        data-testid="app-root"
        className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 bg-[var(--bg)] px-6 py-8 text-[var(--text-primary)]"
      >
        {storageError && (
          <Alert tone="warning" onDismiss={() => setStorageError(false)}>
            <AlertTitle>{translate(lang, 'storage_load_error_title')}</AlertTitle>
          </Alert>
        )}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">pomodoro.</h1>
          <LanguageToggle lang={lang} onChange={handleLang} />
        </header>
        <TimerPanel
          phase={snap.phase}
          timeLeft={snap.timeLeft}
          pomodoroCount={snap.pomodoroCount}
          progress={snap.progress}
        />
        <ControlsRow
          running={snap.running}
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
        />
        <TaskSection
          tasks={pending}
          queuedIds={queuedIds}
          selectedId={selectedId}
          activeTitle={activeTitle}
          onAdd={handleAdd}
          onSelect={setSelectedId}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onUndo={handleUndo}
          onQueue={handleQueue}
          onNext={handleNext}
        />
        <SettingsRow durations={durations} onChange={handleDurations} />
        <StatsFooter completedToday={snap.completedToday} warning={saveWarning} />
        <PhaseToast kind={phaseToastKind} onDismiss={() => setPhaseToastKind(null)} />
      </div>
    </I18nProvider>
  );
}
