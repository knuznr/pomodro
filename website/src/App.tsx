import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { VelocityToast } from '@/components/ui/velocity-toast';
import { PhaseTabs } from '@/components/pomodoro/PhaseTabs';
import { PreferencesCard } from '@/components/pomodoro/PreferencesCard';
import { StatsCard } from '@/components/pomodoro/StatsCard';
import { SpotifyCard } from '@/components/pomodoro/SpotifyCard';
import { ThemeToggle } from '@/components/pomodoro/ThemeToggle';
import { ControlsRow } from '@/components/pomodoro/ControlsRow';
import { LanguageToggle } from '@/components/pomodoro/LanguageToggle';
import { StatsFooter } from '@/components/pomodoro/StatsFooter';
import { TaskSection } from '@/components/pomodoro/TaskSection';
import { TimerPanel } from '@/components/pomodoro/TimerPanel';
import { ensureChime, playChime } from '@/lib/chime';
import {
  DEFAULT_PREFS,
  parsePrefs,
  shouldAutoStart,
  siteTheme,
  withHistory,
  type Prefs,
  type Sound,
} from '@/lib/prefs';
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

interface DefaultStorageDecision {
  storage: PomodoroStorage;
  /** True when the browser offers a durable store (the IndexedDB global). */
  durable: boolean;
}

/**
 * Gated + memoized default storage. `createIndexedDbStorage`'s `= indexedDB`
 * default parameter would throw a ReferenceError where the global is absent
 * (jsdom, hardened private modes), so the decision is guarded with `typeof`
 * and only evaluated on first render — never at module import. The decision
 * also records WHICH branch it took: spec §11 pins a one-time muted notice
 * to the in-memory fallback, so the component needs the durability verdict,
 * not just the adapter.
 */
let defaultDecision: DefaultStorageDecision | null = null;
function getDefaultStorage(): DefaultStorageDecision {
  if (!defaultDecision) {
    const durable = typeof indexedDB !== 'undefined';
    defaultDecision = {
      storage: durable ? createIndexedDbStorage() : createMemoryStorage(),
      durable,
    };
  }
  return defaultDecision;
}

const TICK_MS = 200;

/** Keys that keep their own meaning while a form control has focus. */
const isInteractive = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  el.closest('input, textarea, select, button, [role="switch"], [contenteditable]') !== null;

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const TOAST_MS = 5000;

/**
 * Session-end toast; `kind` is the phase that just ENDED — desktop wording
 * parity (app.py show_notification): a work session that ended announces
 * "Çalışma tamamlandı" (work strings), a finished break announces "Mola bitti".
 * `position` joins the undo toast's bottom-right anchor so both in-app toasts
 * share one screen corner (final review Finding 6).
 */
function PhaseToast({ kind, onDismiss }: { kind: 'work' | 'break' | null; onDismiss: () => void }) {
  const { t } = useI18n();
  return (
    <VelocityToast
      open={kind !== null}
      onDismiss={onDismiss}
      duration={TOAST_MS}
      variant={kind === 'break' ? 'info' : 'success'}
      position="bottom-right"
      title={kind === 'break' ? t('toast_break_title') : t('toast_work_title')}
      description={kind === 'break' ? t('toast_break_description') : t('toast_work_description')}
    />
  );
}

export default function PomodoroApp({ storage: injectedStorage }: PomodoroAppProps = {}) {
  // Default selection path (no storage prop): the memoized decision above
  // picks the adapter. An injected storage counts as durable by declaration
  // — the §11 notice describes the browser environment, not tests or a
  // future explicitly-wired adapter.
  const { storage, durable } = injectedStorage
    ? { storage: injectedStorage, durable: true }
    : getDefaultStorage();
  // Spec §11: one-time muted notice for the in-memory fallback. It renders
  // for the whole session in a muted tone (never error-style, independent of
  // saveWarning/loadError) and can only appear on the default path.
  const storageFallbackNotice = !durable;
  const storeRef = useRef(new TaskStore());
  const queueRef = useRef(new FocusQueue(storeRef.current));
  const durationsRef = useRef<Durations>(DEFAULT_DURATIONS);
  const activeIdRef = useRef<number | null>(null);
  const storageRef = useRef<PomodoroStorage>(storage);
  const engineRef = useRef<TimerEngine | null>(null);
  // Id of the pending phase-end toast belt timeout; it is re-armed at every
  // phase end and must never outlive the unmounted App.
  const toastTimerRef = useRef<number | null>(null);
  const prefsRef = useRef<Prefs>(DEFAULT_PREFS);
  const langRef = useRef<Lang>('tr');

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
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [askFocusDone, setAskFocusDone] = useState(false);
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
      durations: [durationsRef.current.work, durationsRef.current.short, durationsRef.current.long],
      day: engineInstance.currentDay(),
      completed: engineInstance.snapshot().completedToday,
    };
    // Desktop parity (app.py save_state with rollover_day relabeling the
    // footer before the status check): a SUCCESSFUL save clears an earlier
    // disk warning and a failure re-raises it. The load-error banner
    // (storageError) is independent — only the user's dismiss clears it.
    // Web-only extras: today's count joins the rolling history.
    const nextPrefs = {
      ...prefsRef.current,
      history: withHistory(prefsRef.current.history, state.day, state.completed),
    };
    prefsRef.current = nextPrefs;
    setPrefsState(nextPrefs);
    void activeStorage.savePrefs?.(nextPrefs)?.catch(() => setSaveWarning(true));
    activeStorage
      .save(state)
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
      playChime(prefsRef.current.sound);
      // nextPhase is the phase the engine advanced TO — the toast announces
      // the one that just ENDED. The engine keeps the timer stopped (no
      // auto-start); we only celebrate + persist, desktop save_state parity.
      const kind: 'work' | 'break' = nextPhase === 'work' ? 'break' : 'work';
      setPhaseToastKind(kind);
      // A finished work session with a focus task asks whether it is done.
      if (kind === 'work' && activeIdRef.current !== null) setAskFocusDone(true);
      // The engine leaves the clock stopped; the opt-in prefs start it again.
      if (shouldAutoStart(prefsRef.current, nextPhase)) engineRef.current?.start();
      if (
        prefsRef.current.notifications &&
        document.visibilityState === 'hidden' &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        const key = kind === 'break' ? 'toast_break' : 'toast_work';
        new Notification(translate(langRef.current, `${key}_title`), {
          body: translate(langRef.current, `${key}_description`),
        });
      }
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
      let loadedPrefs = DEFAULT_PREFS;
      try {
        loadedPrefs = parsePrefs(await storage.loadPrefs?.());
      } catch {
        // extras are optional — defaults keep the app fully usable
      }
      // The portfolio owns the theme when it has one; only its explicit
      // choice overrides the stored pomodoro pref.
      const portfolioTheme = siteTheme();
      if (portfolioTheme !== null) loadedPrefs = { ...loadedPrefs, theme: portfolioTheme };
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
      prefsRef.current = loadedPrefs;
      langRef.current = langValue;
      setPrefsState(loadedPrefs);
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
    langRef.current = next;
    setLangState(next);
    void storageRef.current.saveLang(next).catch(() => setSaveWarning(true));
  }, []);

  const handleStart = useCallback(() => {
    ensureChime(); // inside the click gesture — autoplay policy
    setAskFocusDone(false);
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

  const handlePrefs = useCallback((patch: Partial<Prefs>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefsState(next);
    try {
      localStorage.setItem('theme', next.theme);
    } catch {
      // storage may be missing or full — the pref still applies this session
    }
    void storageRef.current.savePrefs?.(next)?.catch(() => setSaveWarning(true));
  }, []);

  const handlePreview = useCallback((sound: Sound) => {
    ensureChime(); // inside the change/click gesture — autoplay policy
    playChime(sound);
  }, []);

  const handleSkip = useCallback(() => {
    engineRef.current?.skip();
    if (engineRef.current) setSnap(engineRef.current.snapshot());
  }, []);

  const handleExtend = useCallback((minutes: number) => {
    engineRef.current?.extend(minutes);
    if (engineRef.current) setSnap(engineRef.current.snapshot());
  }, []);

  const handleSelectPhase = useCallback((phase: Phase) => {
    engineRef.current?.selectPhase(phase);
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

  const completeTask = useCallback(
    (id: number) => {
      try {
        storeRef.current.complete(id);
      } catch {
        return;
      }
      refresh();
      persist();
    },
    [refresh, persist],
  );

  const deleteTask = useCallback(
    (id: number) => {
      try {
        storeRef.current.remove(id);
      } catch {
        return;
      }
      refresh();
      persist();
    },
    [refresh, persist],
  );

  const handleComplete = useCallback(() => {
    if (selectedId !== null) completeTask(selectedId);
  }, [selectedId, completeTask]);

  const handleDelete = useCallback(() => {
    if (selectedId !== null) deleteTask(selectedId);
  }, [selectedId, deleteTask]);

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
    setAskFocusDone(false);
    refresh();
    persist();
  }, [refresh, persist]);

  /** "Task finished?" answer: yes completes the focus task and pulls the next queued one. */
  const handleFocusDone = useCallback(
    (done: boolean) => {
      setAskFocusDone(false);
      if (!done) return;
      const active = activeIdRef.current;
      if (active !== null) completeTask(active);
      handleNext();
    },
    [completeTask, handleNext],
  );

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

  const running = snap?.running ?? false;
  const phase = snap?.phase ?? 'work';
  const timeLeft = snap?.timeLeft ?? 0;
  const ready = engine !== null && snap !== null;

  /** Keyboard shortcuts: Space start/pause, R reset, N next task. */
  useEffect(() => {
    if (!ready) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isInteractive(event.target)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (running) handlePause();
        else handleStart();
      } else if (event.key.toLowerCase() === 'r') {
        handleReset();
      } else if (event.key.toLowerCase() === 'n') {
        handleNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, running, handleStart, handlePause, handleReset, handleNext]);

  /** Countdown in the tab title while the timer runs. */
  useEffect(() => {
    if (!ready) return;
    document.title = running
      ? `${clock(timeLeft)} · ${translate(lang, `status_${phase}`)}`
      : 'pomodoro.';
    return () => {
      document.title = 'pomodoro.';
    };
  }, [ready, running, timeLeft, phase, lang]);

  /** Closing the tab mid-session asks for confirmation. */
  useEffect(() => {
    if (!running) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [running]);

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs.theme]);

  if (!engine || !snap) {
    return <div className="min-h-screen bg-bg" data-testid="app-root" />;
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
        className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 lg:max-w-4xl px-5 py-8 sm:py-12 text-[var(--text-primary)]"
      >
        {storageError && (
          <Alert tone="warning" onDismiss={() => setStorageError(false)}>
            <AlertTitle>{translate(lang, 'storage_load_error_title')}</AlertTitle>
          </Alert>
        )}
        {storageFallbackNotice && (
          // Spec §11 "one-time muted notice": muted neutral tone with an
          // informational icon — deliberately NOT the warning banner above.
          <Alert tone="neutral">
            <AlertTitle>{translate(lang, 'storage_fallback_notice')}</AlertTitle>
          </Alert>
        )}
        <header className="flex items-center justify-between border-b-[3px] border-[var(--text-primary)] pb-3">
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-extrabold tracking-tight max-[359px]:hidden"
            >
              kaan uzuner
            </a>
            <span className="hidden text-sm text-[var(--text-muted)] sm:inline">/</span>
            <h1 className="whitespace-nowrap text-base font-extrabold tracking-tight sm:text-xl">
              pomodoro<span className="text-[var(--signal)]">.</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={prefs.theme} onChange={(theme) => handlePrefs({ theme })} />
            <LanguageToggle lang={lang} onChange={handleLang} />
          </div>
        </header>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
          <div className="flex min-w-0 flex-col gap-5">
            <PhaseTabs phase={snap.phase} running={snap.running} onSelect={handleSelectPhase} />
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
              onSkip={handleSkip}
              onExtend={handleExtend}
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
              onCompleteTask={completeTask}
              onDeleteTask={deleteTask}
              askFocusDone={askFocusDone}
              onFocusDone={handleFocusDone}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <StatsCard
              today={engine.currentDay()}
              completedToday={snap.completedToday}
              goal={prefs.goal}
              history={prefs.history}
            />
            <SpotifyCard prefs={prefs} onChange={handlePrefs} />
            <PreferencesCard
              prefs={prefs}
              onChange={handlePrefs}
              onPreview={handlePreview}
              durations={durations}
              onDurations={handleDurations}
            />
            <StatsFooter completedToday={snap.completedToday} warning={saveWarning} />
          </div>
        </div>
        <PhaseToast kind={phaseToastKind} onDismiss={() => setPhaseToastKind(null)} />
      </div>
    </I18nProvider>
  );
}
