import { TaskStore, TaskNotFoundError } from './tasks';
import type { Task } from './types';

/**
 * Direct port of pomodoro/focus_queue.py: FIFO, dedupe, completed tasks are
 * rejected on enqueue, takeNext silently skips deleted/completed entries and
 * leaves the survivors untouched in the store.
 */
export class FocusQueue {
  queue: number[] = [];

  // Explicit field instead of a constructor parameter property: the project's
  // tsconfig enables `erasableSyntaxOnly`, which forbids parameter properties.
  private readonly store: TaskStore;

  constructor(store: TaskStore) {
    this.store = store;
  }

  enqueue(id: number): void {
    let task: Task;
    try {
      task = this.store.get(id);
    } catch {
      throw new TaskNotFoundError(id);
    }
    if (task.completed) {
      throw new Error(`Task ${id} already completed`);
    }
    if (this.queue.includes(id)) {
      return;
    }
    this.queue.push(id);
  }

  takeNext(): Task | null {
    while (this.queue.length > 0) {
      const id = this.queue.shift() as number;
      let task: Task | undefined;
      try {
        task = this.store.get(id);
      } catch {
        continue; // task was deleted after being queued — skip it
      }
      if (!task.completed) {
        return task;
      }
    }
    return null;
  }

  pendingIds(): number[] {
    const ids: number[] = [];
    for (const id of this.queue) {
      try {
        const task = this.store.get(id);
        if (!task.completed) {
          ids.push(id);
        }
      } catch {
        continue; // deleted since queueing — not pending
      }
    }
    return ids;
  }
}
