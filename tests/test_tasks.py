import pytest

from pomodoro.tasks import TaskStore


def test_pending_starts_empty():
    assert TaskStore().pending() == []


def test_add_cleans_title_and_assigns_ids():
    store = TaskStore()
    first = store.add('  Windows paketini dene  ')
    second = store.add('README düzenle')
    assert (first.id, first.title, first.completed) == (1, 'Windows paketini dene', False)
    assert second.id == 2


@pytest.mark.parametrize('title', ['', '   '])
def test_invalid_title_does_not_consume_id(title):
    store = TaskStore()
    with pytest.raises(ValueError):
        store.add(title)
    assert store.add('Geçerli görev').id == 1


def test_duplicate_titles_have_distinct_ids():
    store = TaskStore()
    first = store.add('Oku')
    second = store.add('Oku')
    assert first.id != second.id
    assert len(store.pending()) == 2


def test_pending_filters_completed_and_preserves_insertion_order():
    store = TaskStore()
    first = store.add('Z raporu')
    middle = store.add('B raporu')
    last = store.add('A raporu')
    store.complete(middle.id)
    assert [task.id for task in store.pending()] == [first.id, last.id]
    assert all(not task.completed for task in store.pending())


def test_pending_empty_after_all_completed():
    store = TaskStore()
    task = store.add('Bitir')
    store.complete(task.id)
    assert store.pending() == []


def test_complete_is_repeatable_and_get_preserves_state():
    store = TaskStore()
    task = store.add('Oku')
    store.complete(task.id)
    store.complete(task.id)
    assert store.get(task.id).completed is True


def test_missing_id_raises_key_error():
    store = TaskStore()
    with pytest.raises(KeyError):
        store.get(99)
    with pytest.raises(KeyError):
        store.complete(99)


def test_stores_are_independent():
    first = TaskStore()
    second = TaskStore()
    first.add('Sadece ilk depoda')
    assert second.pending() == []
    assert second.add('İkinci depo').id == 1

def test_stores_deleting_task():
    store = TaskStore()
    first = store.add("Oku")
    second = store.add("Yaz")

    removed = store.remove(first.id)

    assert removed is first
    assert [task.id for task in store.pending()] == [second.id]
    assert store.add("Test et").id == 3


def test_remove_unknown_id_keeps_existing_tasks():
    store = TaskStore()
    task = store.add('Kalsın')
    with pytest.raises(KeyError):
        store.remove(99)
    assert store.get(task.id) is task


def test_remove_same_id_twice_raises_key_error():
    store = TaskStore()
    task = store.add('Sil')
    store.complete(task.id)
    removed = store.remove(task.id)
    assert removed is task
    assert removed.completed is True
    with pytest.raises(KeyError):
        store.get(task.id)
    with pytest.raises(KeyError):
        store.remove(task.id)

def test_undo():
    store = TaskStore()
    a = store.add("Oku")
    b = store.add("Yaz")

    store.remove(a.id)
    store.remove(b.id)

    assert store.undo_remove() is b
    assert store.undo_remove() is a
    assert store.undo_remove() is None
    assert store.get(a.id) is a
    assert store.add("Test et").id == 3
