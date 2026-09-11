from collections import deque
from pomodoro.tasks import TaskStore, Task


class FocusQueue:
    def __init__(self, store: TaskStore):
        self.store = store
        self.queue: deque[int] = deque()

    def enqueue(self, task_id: int) -> None:
        task = self.store.get(task_id)
        if task.completed:
            raise ValueError("Task {} already completed".format(task_id))

        if task_id in self.queue:
            return

        self.queue.append(task_id)


    def take_next(self) -> Task | None:
        while self.queue:
            task_id = self.queue.popleft()
            try:
                task = self.store.get(task_id)
            except KeyError:
                continue
            if not task.completed:
                return task
        return None

    def pending_ids(self) -> list[int]:
        result = []
        for task_id in self.queue:
            try:
                task = self.store.get(task_id)
            except KeyError:
                continue
            if not task.completed:
                result.append(task_id)
        return result
