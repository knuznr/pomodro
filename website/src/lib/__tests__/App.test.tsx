import { render, screen, within } from '@testing-library/react';
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
});
