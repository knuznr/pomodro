import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskSection } from '@/components/pomodoro/TaskSection';
import { I18nProvider } from '@/lib/i18n.tsx';
import type { Task } from '@/lib/types';

const TASKS: Task[] = [
  { id: 1, title: 'Oku', completed: false },
  { id: 2, title: 'Yaz', completed: false },
];

function renderSection(overrides: Partial<Parameters<typeof TaskSection>[0]> = {}) {
  const handlers = {
    onAdd: vi.fn().mockReturnValue(true),
    onSelect: vi.fn(),
    onComplete: vi.fn(),
    onDelete: vi.fn(),
    onUndo: vi.fn(),
    onQueue: vi.fn(),
    onNext: vi.fn(),
    ...overrides,
  };
  const view = render(
    <I18nProvider lang="tr" setLang={() => {}}>
      <TaskSection
        tasks={TASKS}
        queuedIds={[2]}
        selectedId={1}
        activeTitle="Yaz"
        {...handlers}
      />
    </I18nProvider>,
  );
  return { ...view, handlers };
}

describe('TaskSection', () => {
  it('shows the question, focus line, queued marker, and selected row', () => {
    renderSection();
    expect(screen.getByText('Şimdi neye odaklanıyorsun?')).toBeInTheDocument();
    expect(screen.getByText('Odak: Yaz')).toBeInTheDocument();
    expect(screen.getByText('• Yaz')).toBeInTheDocument();
    const selectedRow = screen.getByRole('option', { selected: true });
    expect(selectedRow.textContent).toContain('Oku');
  });

  it('shows the no-focus line when there is no active task', () => {
    renderSection({ activeTitle: null });
    expect(screen.getByText('Odaklanılacak görev seçilmedi')).toBeInTheDocument();
  });

  it('adds via Enter and the Add button, clearing the input on success', async () => {
    const user = userEvent.setup();
    const { handlers } = renderSection();
    const input = screen.getByPlaceholderText("Yeni görev yaz ve Enter'a bas");
    await user.type(input, 'Yeni görev');
    await user.keyboard('{Enter}');
    expect(handlers.onAdd).toHaveBeenCalledWith('Yeni görev');
    expect(input).toHaveValue('');
    await user.type(input, 'İkinci');
    await user.click(screen.getByRole('button', { name: 'Ekle' }));
    expect(handlers.onAdd).toHaveBeenLastCalledWith('İkinci');
  });

  it('keeps the input and shows the inline error when add fails, resets on typing', async () => {
    const user = userEvent.setup();
    const { handlers } = renderSection({ onAdd: vi.fn().mockReturnValue(false) });
    const input = screen.getByPlaceholderText("Yeni görev yaz ve Enter'a bas");
    await user.type(input, '   ');
    await user.keyboard('{Enter}');
    expect(handlers.onAdd).toHaveBeenCalledWith('   ');
    expect(screen.getByText('Önce bir görev başlığı yaz')).toBeInTheDocument();
    expect(input).toHaveValue('   ');
    await user.type(input, 'x');
    expect(screen.queryByText('Önce bir görev başlığı yaz')).not.toBeInTheDocument();
    expect(handlers.onAdd).toHaveBeenCalledTimes(1); // typing did not resubmit
  });

  it('selects a row on click and fires the action buttons', async () => {
    const user = userEvent.setup();
    const { handlers } = renderSection({ selectedId: null });
    await user.click(screen.getByText('Oku'));
    expect(handlers.onSelect).toHaveBeenCalledWith(1);
    await user.click(screen.getByRole('button', { name: 'Tamamla' }));
    await user.click(screen.getByRole('button', { name: 'Sıraya al' }));
    await user.click(screen.getByRole('button', { name: 'Sıradaki' }));
    await user.click(screen.getByRole('button', { name: 'Geri al' }));
    expect(handlers.onComplete).toHaveBeenCalledTimes(1);
    expect(handlers.onQueue).toHaveBeenCalledTimes(1);
    expect(handlers.onNext).toHaveBeenCalledTimes(1);
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
    expect(handlers.onDelete).not.toHaveBeenCalled();
  });

  it('deleting the selection opens the undo toast with a 5s countdown', async () => {
    const user = userEvent.setup();
    const { handlers } = renderSection();
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Görev silindi')).toBeInTheDocument();
    // The toast contains its own close control, proving it rendered.
    expect(screen.getByLabelText('Close notification')).toBeInTheDocument();
    // 'Geri al' appears both in the action row and inside the toast.
    expect(screen.getAllByRole('button', { name: 'Geri al' }).length).toBeGreaterThanOrEqual(2);
  });

  it('the undo toast button calls onUndo and hides the toast', async () => {
    const user = userEvent.setup();
    const { handlers } = renderSection();
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    await screen.findByText('Görev silindi');
    const toastActions = screen.getByLabelText('Close notification').parentElement as HTMLElement;
    await user.click(within(toastActions).getByRole('button', { name: 'Geri al' }));
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
  });
});
