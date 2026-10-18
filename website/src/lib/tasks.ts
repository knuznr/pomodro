import type { Task } from './types';

export class EmptyTitleError extends Error {
  constructor(message = 'Görev başlığı boş olamaz') {
    super(message);
    this.name = 'EmptyTitleError';
  }
}

export class TaskNotFoundError extends Error {
  constructor(id: number) {
    super(`Task ${id} not found`);
    this.name = 'TaskNotFoundError';
  }
}

/**
 * Direct port of pomodoro/tasks.py. Same behaviors: trim + reject empty titles
 * without consuming ids, insertion-order pending(), LIFO undo stack, KeyError
 * → TaskNotFoundError.
 */
export class TaskStore {
  next_id = 1;
  private tasks = new Map<number, Task>();
  private deletedTasks: Task[] = [];

  add(title: string): Task {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new EmptyTitleError();
    }
    const task: Task = { id: this.next_id, title: trimmed, completed: false };
    this.tasks.set(task.id, task);
    this.next_id += 1;
    return task;
  }

  get(id: number): Task {
    const task = this.tasks.get(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }
    return task;
  }

  complete(id: number): void {
    this.get(id).completed = true;
  }

  pending(): Task[] {
    return [...this.tasks.values()].filter((task) => !task.completed);
  }

  all(): Task[] {
    return [...this.tasks.values()];
  }

  remove(id: number): Task {
    const task = this.get(id);
    this.deletedTasks.push(task);
    this.tasks.delete(id);
    return task;
  }

  undoRemove(): Task | null {
    const task = this.deletedTasks.pop();
    if (!task) {
      return null;
    }
    this.tasks.set(task.id, task);
    return task;
  }

  /**
   * Bulk restore from persisted state (App hydration). Clears first so it is
   * idempotent under React StrictMode double-effects. nextId is normalized
   * upward to keep future ids unique.
   */
  load(tasks: Task[], nextId: number): void {
    this.tasks.clear();
    this.deletedTasks = [];
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }
    const maxY = tasks.reduce((max, task) => Math.max(max, task.id), 0);
    this.next_id = Math.max(nextId, maxY + 1);
  }
}
