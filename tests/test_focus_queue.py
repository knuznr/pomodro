import pytest

from pomodoro.focus_queue import FocusQueue
from pomodoro.tasks import TaskStore


def test_enqueue_preserves_order_without_duplicates():
    store = TaskStore()
    first = store.add('Oku')
    second = store.add('Yaz')
    queue = FocusQueue(store)
    queue.enqueue(second.id)
    queue.enqueue(first.id)
    queue.enqueue(second.id)
    assert list(queue.queue) == [second.id, first.id]


def test_enqueue_missing_task_leaves_queue_unchanged():
    store = TaskStore()
    task = store.add('Oku')
    queue = FocusQueue(store)
    queue.enqueue(task.id)
    with pytest.raises(KeyError):
        queue.enqueue(99)
    assert list(queue.queue) == [task.id]


@pytest.mark.parametrize('already_queued', [False, True])
def test_enqueue_rejects_completed_task(already_queued):
    store = TaskStore()
    task = store.add('Oku')
    queue = FocusQueue(store)
    if already_queued:
        queue.enqueue(task.id)
    before = list(queue.queue)
    store.complete(task.id)
    with pytest.raises(ValueError):
        queue.enqueue(task.id)
    assert list(queue.queue) == before


def test_take_next_empty_queue_returns_none():
    queue = FocusQueue(TaskStore())
    assert queue.take_next() is None


def test_take_next_uses_fifo_and_keeps_tasks_in_store():
    store = TaskStore()
    first = store.add('Oku')
    second = store.add('Yaz')
    queue = FocusQueue(store)
    queue.enqueue(second.id)
    queue.enqueue(first.id)

    assert queue.take_next() is second
    assert queue.take_next() is first
    assert queue.take_next() is None
    assert store.get(first.id) is first
    assert store.get(second.id) is second
    assert first.completed is False
    assert second.completed is False


def test_take_next_skips_deleted_and_completed_tasks():
    store = TaskStore()
    deleted = store.add('Silinecek')
    completed = store.add('Tamamlanacak')
    active = store.add('Yapılacak')
    queue = FocusQueue(store)
    for task in (deleted, completed, active):
        queue.enqueue(task.id)
    store.remove(deleted.id)
    store.complete(completed.id)

    assert queue.take_next() is active
    assert queue.take_next() is None
    assert store.get(active.id).completed is False


def test_take_next_returns_none_when_all_tasks_are_invalid():
    store = TaskStore()
    deleted = store.add('Sil')
    completed = store.add('Bitir')
    queue = FocusQueue(store)
    queue.enqueue(deleted.id)
    queue.enqueue(completed.id)
    store.remove(deleted.id)
    store.complete(completed.id)

    assert queue.take_next() is None
    assert list(queue.queue) == []


def test_taken_task_can_be_enqueued_again():
    store = TaskStore()
    task = store.add('Tekrar odaklan')
    queue = FocusQueue(store)
    queue.enqueue(task.id)
    assert queue.take_next() is task
    queue.enqueue(task.id)
    assert queue.take_next() is task
    assert queue.take_next() is None


def test_pending_ids_does_not_consume_and_supports_restored_tasks():
    store = TaskStore()
    a = store.add('A')
    b = store.add('B')
    queue = FocusQueue(store)
    queue.enqueue(a.id)
    queue.enqueue(b.id)
    store.remove(a.id)
    assert queue.pending_ids() == [b.id]
    store.undo_remove()
    assert queue.pending_ids() == [a.id, b.id]
    store.complete(b.id)
    assert queue.pending_ids() == [a.id]
    assert queue.take_next() is a
    assert queue.take_next() is None
