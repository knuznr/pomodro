import os
os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')

import pytest
from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import QSettings
from app import ModernPomodoroTimer


@pytest.fixture(scope='session')
def qt_app():
    return QApplication.instance() or QApplication([])


@pytest.fixture
def window(qt_app, tmp_path):
    widget = ModernPomodoroTimer(settings=QSettings(str(tmp_path / "settings.ini"), QSettings.IniFormat))
    yield widget
    widget.close()


def test_finish_without_macos_commands(window, monkeypatch):
    import subprocess
    def forbidden(*args, **kwargs):
        raise AssertionError('Platform-specific command called')
    monkeypatch.setattr(subprocess, 'run', forbidden)
    window.timer_finished()
    assert window.is_working is False
    assert window.completed_today == 1
    assert window.time_left == window.break_time


def test_reset_restores_work_progress_style(window, monkeypatch):
    monkeypatch.setattr(window, 'play_notification_sound', lambda: None)
    monkeypatch.setattr(window, 'show_notification', lambda: None)
    window.timer_finished()
    window.reset_timer()
    assert window.progress_bar.styleSheet() == ''
    assert window.time_left == window.work_time
    assert window.is_working


def test_session_indicator_wraps_after_four(window, monkeypatch):
    monkeypatch.setattr(window, 'play_notification_sound', lambda: None)
    monkeypatch.setattr(window, 'show_notification', lambda: None)
    for _ in range(9):
        window.timer_finished()
    assert window.completed_today == 5
    assert '1/4' in window.session_label.text()


def test_window_uses_session_policy(window, monkeypatch):
    import pomodoro.session as session
    original = session.next_break
    calls = []

    def observe(completed):
        calls.append(completed)
        return original(completed)

    monkeypatch.setattr(session, 'next_break', observe)
    monkeypatch.setattr(window, 'play_notification_sound', lambda: None)
    monkeypatch.setattr(window, 'show_notification', lambda: None)
    for completed in range(1, 9):
        window.timer_finished()
        expected = window.long_break_time if completed in (4, 8) else window.break_time
        assert not window.is_working
        assert window.time_left == expected
        window.timer_finished()
        assert window.is_working
        assert window.time_left == window.work_time
    assert calls == list(range(1, 9))


def test_task_ui_roundtrip(window):
    window.task_input.setText('Windows testi')
    window.add_task()
    assert window.task_list.count() == 1
    window.task_list.setCurrentRow(0)
    window.queue_selected_task()
    window.next_task()
    assert 'Windows testi' in window.focus_label.text()
    window.complete_selected_task()
    assert window.task_list.count() == 0


def test_tasks_and_settings_survive_restart(window, qt_app):
    window.task_input.setText('Kalıcı görev')
    window.add_task()
    window.work_spin.setValue(30)
    window.save_state()
    other = ModernPomodoroTimer(settings=window.settings)
    try:
        assert other.work_spin.value() == 30
        assert other.task_list.count() == 1
    finally:
        other.close()


def test_timer_uses_elapsed_time_and_preserves_pause(window, monkeypatch):
    import app as module
    now = [100.0]
    monkeypatch.setattr(module.time, 'monotonic', lambda: now[0])
    window.start_timer()
    now[0] += 7.4
    window.update_timer()
    assert window.time_left == 1493
    window.stop_timer()
    now[0] += 100
    window.start_timer()
    now[0] += 0.6
    window.update_timer()
    assert window.time_left == 1492


def test_ui_delete_undo_and_queue_persist(window):
    window.task_input.setText('Geri al')
    window.add_task()
    window.task_list.setCurrentRow(0)
    window.queue_selected_task()
    window.delete_selected_task()
    assert window.task_list.count() == 0
    window.undo_task()
    assert window.task_list.count() == 1
    assert window.focus_queue.pending_ids() == [1]


def test_day_rollover_resets_daily_count(window):
    window.day = '2000-01-01'
    window.completed_today = 12
    window.rollover_day()
    assert window.completed_today == 0
