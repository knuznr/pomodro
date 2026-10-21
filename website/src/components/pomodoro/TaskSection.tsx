import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { motionTransitions } from '@/lib/motion-tokens';
import { Check, CheckCheck, ListPlus, ListTodo, Plus, SkipForward, Target, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
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
  /** Hover quick actions; act on the given task without touching the selection. */
  onCompleteTask?: (id: number) => void;
  onDeleteTask?: (id: number) => void;
  /** Shown after a work session ends while a focus task is active. */
  askFocusDone?: boolean;
  onFocusDone?: (done: boolean) => void;
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
  onCompleteTask,
  onDeleteTask,
  askFocusDone,
  onFocusDone,
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
    // Desktop parity (app.py delete): with no selection the delete silently
    // no-ops — no handler call and no "Görev silindi" toast claiming a
    // deletion that never happened. App's own handleDelete already returns
    // early on a null selection; this guard keeps the TOAST honest too.
    if (selectedId === null) return;
    onDelete();
    setUndoOpen(true);
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Target className="size-4 text-text-secondary" aria-hidden="true" />
        {t('task_question')}
      </h2>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <LockInput
          className="flex-1"
          aria-label={t('task_question')}
          placeholder={t('task_placeholder')}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (showError) setShowError(false);
          }}
        />
        <Button type="submit" variant="primary" size="md" leftIcon={<Plus className="size-4" />}>{t('add')}</Button>
      </form>
      {showError && (
        <p role="status" className="text-xs text-amber-400">{t('add_error')}</p>
      )}
      <p
        className={`rounded-lg border px-3 py-2 text-sm ${
          activeTitle
            ? 'border-[var(--accent-ring)] bg-[var(--accent-subtle)] text-text-primary'
            : 'border-border bg-surface-raised text-text-muted'
        }`}
      >
        {activeTitle ? t('focus_active', { title: activeTitle }) : t('focus_none')}
      </p>
      {askFocusDone && activeTitle && onFocusDone && (
        <div role="group" aria-label={t('focus_done_q')} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2">
          <span className="mr-auto text-sm text-text-secondary">{t('focus_done_q')}</span>
          <Button variant="primary" size="sm" onClick={() => onFocusDone(true)} leftIcon={<Check className="size-3.5" />}>{t('focus_done_yes')}</Button>
          <Button variant="ghost" size="sm" onClick={() => onFocusDone(false)}>{t('focus_done_no')}</Button>
        </div>
      )}
      <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto" role="listbox" aria-label={t('tasks_list')}>
        <AnimatePresence initial={false}>
        {tasks.map((task) => {
          const selected = task.id === selectedId;
          const queued = queuedIds.includes(task.id);
          return (
            <motion.li
              key={task.id}
              role="option"
              aria-selected={selected}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 16, transition: { duration: 0.15 } }}
              transition={motionTransitions.springSmooth}
              className={`group relative flex items-center rounded-lg border transition-colors ${
                selected
                  ? 'bg-surface-hover outline outline-1 outline-[var(--accent-ring)] border-[var(--border-hover)]'
                  : 'bg-surface-raised border-border hover:bg-surface-hover hover:border-[var(--border-hover)]'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(task.id)}
                className="focus-ring flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm"
              >
                <span
                  aria-hidden="true"
                  className={`grid size-4 shrink-0 place-items-center rounded-full border transition-colors ${
                    selected ? 'border-text-primary bg-text-primary text-bg' : 'border-[var(--border-hover)]'
                  }`}
                >
                  {selected && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="block min-w-0 flex-1 truncate">
                  {queued ? `• ${task.title}` : task.title}
                </span>
              </button>
              <span className="flex gap-0.5 pr-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                {onCompleteTask && (
                  <Button variant="ghost" size="icon" className="size-7" aria-label={t('complete_task', { title: task.title })} onClick={() => onCompleteTask(task.id)}>
                    <Check className="size-3.5" />
                  </Button>
                )}
                {onDeleteTask && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t('delete_task', { title: task.title })}
                    onClick={() => {
                      onDeleteTask(task.id);
                      setUndoOpen(true);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </span>
            </motion.li>
          );
        })}
        </AnimatePresence>
        {tasks.length === 0 && (
          <li>
            <EmptyState icon={<ListTodo className="size-5" />}>{t('tasks_empty')}</EmptyState>
          </li>
        )}
      </ul>
      <div className="flex items-center gap-1.5">
        <Button variant="primary" size="sm" className="min-w-0 flex-1" onClick={onComplete} leftIcon={<CheckCheck className="size-3.5" />}>{t('complete')}</Button>
        <Button variant="secondary" size="icon" className="size-8" onClick={handleDelete} aria-label={t('delete')} title={t('delete')}>
          <Trash2 className="size-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="size-8" onClick={onUndo} aria-label={t('undo')} title={t('undo')}>
          <Undo2 className="size-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="size-8" onClick={onQueue} aria-label={t('queue')} title={t('queue')}>
          <ListPlus className="size-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="size-8" onClick={onNext} aria-label={t('next')} title={t('next')}>
          <SkipForward className="size-3.5" />
        </Button>
      </div>
      </CardContent>
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
    </Card>
  );
}
