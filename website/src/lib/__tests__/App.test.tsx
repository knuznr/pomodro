import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, type Mock } from 'vitest';
// Brief said '../App', but that resolves to src/lib/App — the app lives at src/App.
import PomodoroApp from '../../App';
import type { PomodoroStorage } from '../storage';
import type { StoredState } from '../types';

function makeStorageStub() {
  return {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    loadLang: vi.fn().mockResolvedValue('tr'),
    saveLang: vi.fn().mockResolvedValue(undefined),
  } satisfies PomodoroStorage & Record<string, Mock>;
}

describe('PomodoroApp', () => {
  it('renders the Turkish UI from the stored language', async () => {
    render(<PomodoroApp storage={makeStorageStub()} />);
    expect(await screen.findByRole('button', { name: 'Başlat' })).toBeInTheDocument();
    expect(screen.getByText('Çalışma zamanı')).toBeInTheDocument();
    expect(screen.getByText('Şimdi neye odaklanıyorsun?')).toBeInTheDocument();
  });

  it('walks add → queue → next with persistence, then delete with undo', async () => {
    const user = userEvent.setup();
    const storage = makeStorageStub();
    render(<PomodoroApp storage={storage} />);
    await screen.findByRole('button', { name: 'Başlat' });

    // Empty title is rejected without touching storage (desktop placeholder rule).
    await user.click(screen.getByRole('button', { name: 'Ekle' }));
    expect(await screen.findByText('Önce bir görev başlığı yaz')).toBeInTheDocument();
    expect(storage.save).not.toHaveBeenCalled();

    // Add a task.
    const input = screen.getByPlaceholderText("Yeni görev yaz ve Enter'a bas");
    await user.type(input, 'Test görev');
    await user.click(screen.getByRole('button', { name: 'Ekle' }));
    expect(await screen.findByText('Test görev')).toBeInTheDocument();

    // Queue it, then take it as the focus.
    await user.click(screen.getByText('Test görev'));
    await user.click(screen.getByRole('button', { name: 'Sıraya al' }));
    expect(screen.getByText('• Test görev')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sıradaki' }));
    expect(await screen.findByText('Odak: Test görev')).toBeInTheDocument();

    const lastSave = (storage.save as Mock).mock.calls.at(-1)?.[0] as StoredState;
    expect(lastSave.tasks.map((task) => task.title)).toContain('Test görev');
    expect(lastSave.queue).toEqual([]);
    expect(lastSave.active).toBe(1);

    // Delete → focus line resets, undo toast appears.
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    expect(await screen.findByText('Görev silindi')).toBeInTheDocument();
    expect(screen.getByText('Odaklanılacak görev seçilmedi')).toBeInTheDocument();

    // Undo restores the task.
    const toastActions = screen.getByLabelText('Close notification').parentElement as HTMLElement;
    await user.click(within(toastActions).getByRole('button', { name: 'Geri al' }));
    expect(await screen.findByText('Test görev')).toBeInTheDocument();
    expect((storage.save as Mock).mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('switching the language re-renders English and persists the choice', async () => {
    const user = userEvent.setup();
    const storage = makeStorageStub();
    render(<PomodoroApp storage={storage} />);
    await screen.findByRole('button', { name: 'Başlat' });
    await user.click(screen.getByText('EN'));
    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(storage.saveLang).toHaveBeenCalledWith('en');
  });

  it('hydrates tasks, queue, active focus, and the day count from a saved state', async () => {
    const storage = {
      load: vi.fn().mockResolvedValue({
        tasks: [
          { id: 1, title: 'Kayıtlı görev', completed: false },
          { id: 2, title: 'Kuyrukta', completed: false },
          { id: 3, title: 'Bitti', completed: true },
        ],
        next_id: 4,
        queue: [2],
        active: 1,
        durations: [25, 5, 15],
        day: '2026-10-18',
        completed: 3,
      } satisfies StoredState),
      save: vi.fn().mockResolvedValue(undefined),
      loadLang: vi.fn().mockResolvedValue('en'),
      saveLang: vi.fn().mockResolvedValue(undefined),
    } satisfies PomodoroStorage;

    // The plan's step-4 note assumes vitest's setSystemTime "fakes only Date";
    // default fake timers (timers/rAF/performance) deadlock RTL waitFor under
    // React 19 and poison every later test, so fake just the Date.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 18, 12, 0, 0));
    try {
      render(<PomodoroApp storage={storage} />);
      expect(await screen.findByText('Kayıtlı görev')).toBeInTheDocument();
      expect(screen.getByText('• Kuyrukta')).toBeInTheDocument();
      expect(screen.getByText('Focus: Kayıtlı görev')).toBeInTheDocument();
      expect(screen.getByText('Completed today: 3')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
      expect(screen.queryByText('Bitti')).not.toBeInTheDocument(); // completed tasks stay hidden
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the warning banner and defaults when the saved record is invalid', async () => {
    const storage = {
      load: vi.fn().mockResolvedValue({ tasks: 'garbage' }),
      save: vi.fn().mockResolvedValue(undefined),
      loadLang: vi.fn().mockResolvedValue('tr'),
      saveLang: vi.fn().mockResolvedValue(undefined),
    } satisfies PomodoroStorage;
    render(<PomodoroApp storage={storage} />);
    expect(await screen.findByText('Kayıt okunamadı; varsayılan ayarlar açıldı.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Başlat' })).toBeInTheDocument();
  });

  it('falls back to transparent in-session operation when the database is unavailable', async () => {
    const storage = {
      load: vi.fn().mockRejectedValue(new Error('IndexedDB unavailable')),
      save: vi.fn().mockRejectedValue(new Error('IndexedDB unavailable')),
      loadLang: vi.fn().mockRejectedValue(new Error('IndexedDB unavailable')),
      saveLang: vi.fn().mockRejectedValue(new Error('IndexedDB unavailable')),
    } satisfies PomodoroStorage;
    render(<PomodoroApp storage={storage} />);
    expect(await screen.findByText('Kayıt okunamadı; varsayılan ayarlar açıldı.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Başlat' })).toBeInTheDocument();
    const input = screen.getByPlaceholderText("Yeni görev yaz ve Enter'a bas");
    const user = userEvent.setup();
    await user.type(input, 'Geçici görev');
    await user.click(screen.getByRole('button', { name: 'Ekle' }));
    expect(await screen.findByText('Geçici görev')).toBeInTheDocument();
    // The failing save flips the footer warning (async) — poll for it.
    expect(await screen.findByRole('status')).toHaveTextContent('Ayarlar kaydedilemedi');
  });

  it('changing a duration while idle updates the clock display and persists', async () => {
    const user = userEvent.setup();
    const storage = makeStorageStub();
    render(<PomodoroApp storage={storage} />);
    await screen.findByRole('button', { name: 'Başlat' });
    expect(document.querySelector('[aria-label="25"]')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Çalışma'));
    await user.type(screen.getByLabelText('Çalışma'), '30');
    expect(document.querySelector('[aria-label="30"]')).toBeInTheDocument();
    expect(storage.save).toHaveBeenCalled();
  });

  it('ends a work session on the clock: work toast, short break, one save', async () => {
    // Fresh stub — nothing but the touched flows below reach `save`, so the
    // save counts asserted here are exact, not deltas: 0 after hydration,
    // 1 for the task add, still 1 after Start, 2 after the phase-end tick.
    const storage = makeStorageStub();
    // App constructs TimerEngine without `now`, so the clock is performance.now.
    let nowMs = 0;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    // Vitest's shared fake clock: user-event/React Testing Library drive the
    // faked timers through a `jest` global that vitest 3 never provides (the
    // existing Date-only note above documents the alternative deadlock), so
    // this minimal shim is scoped here to make `await user.*` cooperate —
    // vitest's sinon-based faked setTimeout always carries `.clock`.
    type JestCompat = { advanceTimersByTime(ms: number): void };
    const fakeGlobal = globalThis as unknown as { jest?: JestCompat };
    fakeGlobal.jest = {
      advanceTimersByTime: (ms: number) => {
        vi.advanceTimersByTime(ms);
      },
    };
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    // Clock-bookkeeping spies: they let the final assert identify the exact
    // phase-end belt timeout and heartbeat interval ids that unmount cleared
    // (jsdom+framer's own rAF frame-driver interval also lives under fake
    // timers, so raw timer counts are unusably noisy).
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    // `delay: null` keeps user-event off timer-based pacing between keys.
    const user = userEvent.setup({ delay: null });
    const { unmount } = render(<PomodoroApp storage={storage} />);

    try {
      await screen.findByRole('button', { name: 'Başlat' });
      expect(screen.getByRole('button', { name: 'Başlat' })).toBeEnabled();
      // Hydrate/lang never persist on a fresh store (counting baseline: 0).
      expect(storage.save).not.toHaveBeenCalled();
      expect(screen.getByText('Çalışma zamanı')).toBeInTheDocument();

      // One task keeps the phase-end row-shape assert below meaningful; its
      // own save is the single call before the timer flows start.
      const input = screen.getByPlaceholderText("Yeni görev yaz ve Enter'a bas");
      await user.type(input, 'Test görev');
      await user.click(screen.getByRole('button', { name: 'Ekle' }));
      expect(screen.getByText('Test görev')).toBeInTheDocument();
      expect(storage.save).toHaveBeenCalledTimes(1); // the task add

      // Starting the timer persists NOTHING (desktop parity: no save on start).
      await user.click(screen.getByRole('button', { name: 'Başlat' }));
      expect(storage.save).toHaveBeenCalledTimes(1);

      // Run the mocked clock past the whole 25-minute work phase (25 min + ε),
      // then fire exactly ONE 200 ms heartbeat tick — the phase ends in it.
      nowMs = 25 * 60 * 1000 + 1;
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // The work-end toast shows the real desktop copy (i18n toast_work_*).
      expect(screen.getByText('Çalışma tamamlandı')).toBeInTheDocument();
      expect(screen.getByText('Biraz dinlenme zamanı.')).toBeInTheDocument();

      // The engine advanced TO the short break and stays stopped: Start is
      // re-enabled and Pause is disabled — the timer did NOT auto-start.
      expect(screen.getByText('Kısa mola zamanı')).toBeInTheDocument();
      expect(screen.getByText('Bugün tamamlanan: 1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Başlat' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Duraklat' })).toBeDisabled();

      // The phase-end flow saved exactly once more (2 total with the task
      // add) with the persisted phase-end state: completed bumped to 1,
      // 3-key task rows, non-empty day, default durations.
      expect(storage.save).toHaveBeenCalledTimes(2);
      const phaseEndSave = storage.save.mock.calls[1][0] as StoredState;
      expect(phaseEndSave.completed).toBe(1);
      expect(phaseEndSave.day).toBeTruthy();
      expect(phaseEndSave.tasks.map((task) => task.title)).toContain('Test görev');
      expect(Object.keys(phaseEndSave.tasks[0]).sort()).toEqual(['completed', 'id', 'title']);
      expect(phaseEndSave.durations).toEqual([25, 5, 15]);

      // Unmount explicitly cleared the phase-end belt timeout the App armed
      // (delay = TOAST_MS + 500 = 5500) and the 200 ms heartbeat interval.
      // Vitest's sinon-14 fake timers hand back timer ref-objects, so the
      // identity check below is the id check.
      const beltId = setTimeoutSpy.mock.results[
        setTimeoutSpy.mock.calls.findIndex((call) => call[1] === 5500)
      ]?.value;
      expect(beltId).toBeDefined();
      const tickId = setIntervalSpy.mock.results[
        setIntervalSpy.mock.calls.findIndex((call) => call[1] === 200)
      ]?.value;
      expect(tickId).toBeDefined();
      unmount();
      expect(clearTimeoutSpy.mock.calls.flat()).toContain(beltId);
      expect(clearIntervalSpy.mock.calls.flat()).toContain(tickId);
    } finally {
      delete fakeGlobal.jest;
      nowSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('clears the footer save warning on the next successful save, keeping the load banner', async () => {
    const user = userEvent.setup();
    const storage = {
      load: vi.fn().mockRejectedValue(new Error('disk unavailable')),
      // First save (first task add) fails; the second succeeds — the desktop
      // clears the disk warning on the next successful save (app.py
      // save_state re-labels the footer) while the load banner stays put.
      save: vi.fn()
        .mockRejectedValueOnce(new Error('disk write failed'))
        .mockResolvedValue(undefined),
      loadLang: vi.fn().mockResolvedValue('tr'),
      saveLang: vi.fn().mockResolvedValue(undefined),
    } satisfies PomodoroStorage & Record<string, Mock>;
    render(<PomodoroApp storage={storage} />);
    await screen.findByRole('button', { name: 'Başlat' });

    const loadBanner = 'Kayıt okunamadı; varsayılan ayarlar açıldı.';
    expect(await screen.findByText(loadBanner)).toBeInTheDocument();

    // First add → failing save → footer warning appears.
    const input = screen.getByPlaceholderText("Yeni görev yaz ve Enter'a bas");
    await user.type(input, 'Görev bir');
    await user.click(screen.getByRole('button', { name: 'Ekle' }));
    expect(await screen.findByText('Görev bir')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Ayarlar kaydedilemedi');

    // Second add → successful save → warning clears…
    await user.clear(input);
    await user.type(input, 'Görev iki');
    await user.click(screen.getByRole('button', { name: 'Ekle' }));
    expect(await screen.findByText('Görev iki')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    // …while a save must never touch the load-error banner.
    expect(screen.getByText(loadBanner)).toBeInTheDocument();
  });
});
