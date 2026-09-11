from dataclasses import dataclass


@dataclass
class Task:
    id: int
    title: str
    completed: bool = False


class TaskStore:
    def __init__(self):
        self.tasks: dict[int, Task] = {}
        self.deleted_tasks: list[Task] = []
        self.next_id = 1

    def add(self, title: str) -> Task:
        title = title.strip()

        if not title:
            raise ValueError("Görev başlığı boş olamaz")

        task =Task(id=self.next_id, title=title)

        self.tasks[task.id] = task
        self.next_id += 1
        return task

    def get(self, task_id: int) -> Task:
        return self.tasks[task_id]


    def complete(self, task_id: int) -> None:
        task = self.get(task_id)
        task.completed = True

    def pending(self) -> list[Task]:
        new_pending_list = []

        for task in self.tasks.values():
            if not task.completed:
                new_pending_list.append(task)

        return new_pending_list

    def remove(self, task_id: int) -> Task:
        task = self.get(task_id)
        if not task:
            raise KeyError("Task {} doesn't exist".format(task_id))

        self.deleted_tasks.append(task)
        return self.tasks.pop(task.id, task)

    def undo_remove(self) -> Task | None:
        if not self.deleted_tasks:
            return None

        task = self.deleted_tasks.pop(-1)
        self.tasks[task.id] = task
        return task
