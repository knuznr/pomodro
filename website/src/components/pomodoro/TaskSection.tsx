import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LockInput } from '@/components/ui/lock-input';
import { UndoToast } from '@/components/ui/undo-toast';
import { useI18n } from '@/lib/i18n.tsx';
import type { Task } from '@/lib/types';

interface TaskSectionProps {
  tasks: Task[];
  queuedIds: number[];
  selectedId: number | null;
  activeTitle: string | null;
  onAdd: (title: string) => boolean;
  onSelect: (id: number) => void;
  onComplete: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onQueue: () => void;
  onNext: () => void;
}

export function TaskSection({
  tasks,
  queuedIds,
  selectedId,
  activeTitle,
  onAdd,
  onSelect,
  onComplete,
  onDelete,
  onUndo,
  onQueue,
  onNext,
}: TaskSectionProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [showError, setShowError] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);

  const submit = () => {
    if (!onAdd(title)) {
      setShowError(true);
      return;
    }
    setTitle('');
    setShowError(false);
  };

  const handleDelete = () => {
    onDelete();
    setUndoOpen(true);
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-text-secondary">{t('task_question')}</h2>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <LockInput
          className="flex-1"
          placeholder={t('task_placeholder')}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (showError) setShowError(false);
          }}
        />
        <Button type="submit" variant="secondary" size="lg">{t('add')}</Button>
      </form>
      {showError && (
        <p role="status" className="text-xs text-rose-400">{t('add_error')}</p>
      )}
      <p className="text-sm text-text-muted">
        {activeTitle ? t('focus_active', { title: activeTitle }) : t('focus_none')}
      </p>
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto" role="listbox" aria-label="tasks">
        {tasks.map((task) => {
          const selected = task.id === selectedId;
          const queued = queuedIds.includes(task.id);
          return (
            <li key={task.id} role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => onSelect(task.id)}
                className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selected
                    ? 'bg-surface-hover outline outline-1 outline-[var(--accent-ring)] border-[var(--border-hover)]'
                    : 'bg-surface-raised border-border hover:bg-surface-hover'
                }`}
              >
                <span className="block truncate">
                  {queued ? `• ${task.title}` : task.title}
                </span>
              </button>
            </li>
          );
        })}
        {tasks.length === 0 && (
          <li className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-muted">
            —
          </li>
        )}
      </ul>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onComplete}>{t('complete')}</Button>
        <Button variant="secondary" size="sm" onClick={handleDelete}>{t('delete')}</Button>
        <Button variant="secondary" size="sm" onClick={onUndo}>{t('undo')}</Button>
        <Button variant="secondary" size="sm" onClick={onQueue}>{t('queue')}</Button>
        <Button variant="secondary" size="sm" onClick={onNext}>{t('next')}</Button>
      </div>
      <UndoToast
        open={undoOpen}
        title={t('undo_toast_title')}
        undoLabel={t('undo')}
        duration={5000}
        variant="info"
        position="bottom-right"
        onUndo={() => {
          onUndo();
          setUndoOpen(false);
        }}
        onDismiss={() => setUndoOpen(false)}
      />
    </section>
  );
}
