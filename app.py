import sys
import json
import time
import math
from datetime import date
from dataclasses import asdict
from pomodoro.tasks import TaskStore, Task
from pomodoro.focus_queue import FocusQueue
from pomodoro import session
from PyQt5.QtWidgets import (QApplication, QWidget, QVBoxLayout, QHBoxLayout,
                             QLabel, QPushButton, QProgressBar, QSpinBox,
                             QGroupBox, QLineEdit, QSystemTrayIcon, QStyle, QListWidget, QListWidgetItem)
from PyQt5.QtCore import QTimer, Qt, QSettings
from PyQt5.QtGui import QFont



class ModernPomodoroTimer(QWidget):
    def __init__(self, settings=None):
        super().__init__()

        self.settings = settings if settings is not None else QSettings("Pomodro", "Pomodoro")
        self.store = TaskStore()
        self.focus_queue = FocusQueue(self.store)
        self.active_task_id = None
        self.day = date.today().isoformat()
        self.deadline = None
        self.remaining_seconds = None
        # Zamanlayıcı ayarları
        self.work_time = 25 * 60
        self.break_time = 5 * 60
        self.long_break_time = 15 * 60
        self.time_left = self.work_time
        self.total_time = self.work_time
        self.is_working = True
        self.pomodoro_count = 0
        self.completed_today = 0

        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_timer)

        self.initUI()
        self.apply_theme()
        self.load_state()

    def initUI(self):
        self.setWindowTitle("Pomodoro")
        self.resize(600, 900)
        self.setMinimumSize(520, 820)
        self.setFont(QFont("Segoe UI" if sys.platform == "win32" else "Helvetica Neue", 12))

        layout = QVBoxLayout(self)
        layout.setContentsMargins(32, 28, 32, 28)
        layout.setSpacing(20)
        header = QHBoxLayout()
        brand = QLabel("pomodoro.")
        brand.setObjectName("brand")
        header.addWidget(brand)
        header.addStretch()
        layout.addLayout(header)

        timer_panel = QWidget()
        timer_panel.setObjectName("timerPanel")
        panel = QVBoxLayout(timer_panel)
        panel.setContentsMargins(24, 24, 24, 24)
        panel.setSpacing(12)
        self.status_label = QLabel("Çalışma zamanı")
        self.status_label.setAlignment(Qt.AlignCenter)
        self.status_label.setObjectName("status")
        panel.addWidget(self.status_label)
        self.time_label = QLabel("25:00")
        self.time_label.setAlignment(Qt.AlignCenter)
        self.time_label.setFont(QFont("Consolas" if sys.platform == "win32" else "Menlo", 64))
        self.time_label.setObjectName("timer")
        panel.addWidget(self.time_label)
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(100)
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setFixedHeight(6)
        panel.addWidget(self.progress_bar)
        self.session_label = QLabel("Oturum 0/4")
        self.session_label.setAlignment(Qt.AlignCenter)
        self.session_label.setObjectName("muted")
        panel.addWidget(self.session_label)
        self.session_marks = QLabel("○   ○   ○   ○")
        self.session_marks.setAlignment(Qt.AlignCenter)
        self.session_marks.setObjectName("sessionMarks")
        panel.addWidget(self.session_marks)
        layout.addWidget(timer_panel)

        controls = QHBoxLayout()
        self.start_button = QPushButton("Başlat")
        self.start_button.setObjectName("primary")
        self.stop_button = QPushButton("Duraklat")
        self.reset_button = QPushButton("Sıfırla")
        for button, callback in ((self.start_button, self.start_timer),
                                 (self.stop_button, self.stop_timer),
                                 (self.reset_button, self.reset_timer)):
            button.setMinimumHeight(46)
            button.setCursor(Qt.PointingHandCursor)
            button.clicked.connect(callback)
            controls.addWidget(button)
        self.stop_button.setEnabled(False)
        layout.addLayout(controls)

        task_label = QLabel("Şimdi neye odaklanıyorsun?")
        layout.addWidget(task_label)
        self.task_input = QLineEdit()
        self.task_input.setAccessibleName("Üzerinde çalıştığım görev")
        self.task_input.setMinimumHeight(44)
        task_entry = QHBoxLayout()
        task_entry.addWidget(self.task_input)
        add_button = QPushButton("Ekle")
        add_button.clicked.connect(self.add_task)
        self.task_input.returnPressed.connect(self.add_task)
        task_entry.addWidget(add_button)
        layout.addLayout(task_entry)
        self.task_input.setPlaceholderText("Yeni görev yaz ve Enter'a bas")
        self.focus_label = QLabel("Odaklanılacak görev seçilmedi")
        self.focus_label.setWordWrap(True)
        layout.addWidget(self.focus_label)
        self.task_list = QListWidget()
        self.task_list.setAccessibleName("Tamamlanmamış görevler")
        self.task_list.setMinimumHeight(100)
        layout.addWidget(self.task_list)
        task_controls = QHBoxLayout()
        for title, handler in (("Tamamla", self.complete_selected_task),
                               ("Sil", self.delete_selected_task),
                               ("Geri al", self.undo_task),
                               ("Sıraya al", self.queue_selected_task),
                               ("Sıradaki", self.next_task)):
            button = QPushButton(title)
            button.clicked.connect(handler)
            task_controls.addWidget(button)
        layout.addLayout(task_controls)

        settings = QGroupBox("Seans süreleri · dakika")
        settings_layout = QHBoxLayout(settings)
        settings_layout.setContentsMargins(16, 26, 16, 16)
        self.work_spin = QSpinBox()
        self.break_spin = QSpinBox()
        self.long_break_spin = QSpinBox()
        for name, spin, maximum, value, callback in (
            ("Çalışma", self.work_spin, 60, 25, self.update_work_time),
            ("Kısa mola", self.break_spin, 30, 5, self.update_break_time),
            ("Uzun mola", self.long_break_spin, 60, 15, self.update_long_break_time),
        ):
            column = QVBoxLayout()
            label = QLabel(name)
            label.setBuddy(spin)
            column.addWidget(label)
            spin.setRange(1, maximum)
            spin.setValue(value)
            spin.setAccessibleName(name + " süresi, dakika")
            spin.setMinimumHeight(36)
            spin.valueChanged.connect(callback)
            column.addWidget(spin)
            settings_layout.addLayout(column)
        layout.addWidget(settings)
        layout.addStretch()
        self.stats_label = QLabel("Bu açılışta tamamlanan: 0")
        self.stats_label.setObjectName("muted")
        layout.addWidget(self.stats_label)
        self.tray = QSystemTrayIcon(self.style().standardIcon(QStyle.SP_ComputerIcon), self)
        self.tray.setToolTip("Pomodoro")
        if QSystemTrayIcon.isSystemTrayAvailable():
            self.tray.show()

    def apply_theme(self):
        self.setStyleSheet("""
            QWidget { background: #edf2f4; color: #193744; }
            QLabel#brand { font-size: 24px; font-weight: 700; }
            QLabel#eyebrow { font-size: 10px; color: #526b76; }
            QWidget#timerPanel { background: #dce8ed; border-radius: 24px; }
            QWidget#timerPanel QLabel { background: transparent; }
            QLabel#status { font-size: 15px; font-weight: 600; }
            QLabel#timer { color: #163d50; }
            QLabel#muted { color: #526b76; font-size: 12px; }
            QLabel#sessionMarks { color: #215d74; font-size: 20px; }
            QPushButton { background: #dce5e9; border: 2px solid transparent;
                border-radius: 12px; padding: 8px 12px; font-weight: 600; }
            QPushButton:hover { background: #cedde3; }
            QPushButton#primary { background: #215d74; color: #ffffff; }
            QPushButton#primary:hover { background: #18495d; }
            QPushButton:disabled { background: #e2e8eb; color: #73838a; }
            QPushButton:focus, QLineEdit:focus, QSpinBox:focus { border: 2px solid #397f9a; }
            QLineEdit, QSpinBox { background: #ffffff; border: 2px solid #cedbe1;
                border-radius: 8px; padding: 6px 10px; selection-background-color: #215d74; }
            QListWidget { background: #ffffff; border: 1px solid #cedbe1; border-radius: 10px; padding: 6px; }
            QListWidget::item { padding: 8px; }
            QListWidget::item:selected { background: #215d74; color: white; }
            QGroupBox { border: 1px solid #c8d7de; border-radius: 12px;
                margin-top: 10px; font-size: 12px; }
            QGroupBox::title { subcontrol-origin: margin; left: 14px; padding: 0 5px; }
            QProgressBar { border: none; border-radius: 3px; background: #c0d2db; }
            QProgressBar::chunk { background: #215d74; border-radius: 3px; }
        """)

    def update_timer(self):
        if self.deadline is None:
            return
        self.remaining_seconds = max(0.0, self.deadline - time.monotonic())
        self.time_left = math.ceil(self.remaining_seconds)
        minutes = self.time_left // 60
        seconds = self.time_left % 60
        self.time_label.setText(f"{minutes:02d}:{seconds:02d}")

        # İlerleme çubuğunu güncelle
        progress = (self.time_left / self.total_time) * 100
        self.progress_bar.setValue(int(progress))

        if self.time_left <= 0:
            self.timer.stop()
            self.timer_finished()


    def timer_finished(self):
        self.timer.stop()
        self.deadline = None
        self.remaining_seconds = None
        self.rollover_day()
        # Ses çal
        self.play_notification_sound()

        # İşletim sistemi destekliyorsa bildirim göster
        self.show_notification()


        if self.is_working:
            # Çalışma tamamlandı
            self.pomodoro_count += 1
            self.completed_today += 1
            self.stats_label.setText(f"Bugün tamamlanan: {self.completed_today}")
            cycle_count = (self.pomodoro_count - 1) % 4 + 1
            self.session_label.setText(f"Oturum {cycle_count}/4")
            self.session_marks.setText("   ".join("●" if i < cycle_count else "○" for i in range(4)))

            # 4. pomodoro'dan sonra uzun mola
            if session.next_break(self.pomodoro_count) == "long":
                self.is_working = False
                self.time_left = self.long_break_time
                self.total_time = self.long_break_time
                self.status_label.setText("Uzun mola zamanı")
                self.progress_bar.setStyleSheet("""
                    QProgressBar::chunk { background-color: #8a6034; }
                """)
            else:
                self.is_working = False
                self.time_left = self.break_time
                self.total_time = self.break_time
                self.status_label.setText("Kısa mola zamanı")
                self.progress_bar.setStyleSheet("""
                    QProgressBar::chunk { background-color: #56774a; }
                """)
        else:
            # Mola bitti
            self.is_working = True
            self.time_left = self.work_time
            self.total_time = self.work_time
            self.status_label.setText("Çalışma zamanı")
            self.progress_bar.setStyleSheet("""
                QProgressBar::chunk { background-color: #215d74; }
            """)

        self.time_label.setText(f"{self.time_left // 60:02d}:00")
        self.progress_bar.setValue(100)
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(False)
        self.save_state()

    def play_notification_sound(self):
        QApplication.beep()

    def show_notification(self):
        if self.tray.isVisible() and self.tray.supportsMessages():
            title = "Çalışma tamamlandı" if self.is_working else "Mola bitti"
            message = "Biraz dinlenme zamanı." if self.is_working else "Yeni seansa hazırsın."
            self.tray.showMessage(title, message, QSystemTrayIcon.Information, 5000)

    def start_timer(self):
        if not self.timer.isActive():
            self.rollover_day()
            remaining = self.remaining_seconds if self.remaining_seconds is not None else self.time_left
            self.deadline = time.monotonic() + remaining
            self.timer.start(200)
            self.start_button.setEnabled(False)
            self.stop_button.setEnabled(True)

    def stop_timer(self):
        if self.deadline is not None:
            self.remaining_seconds = max(0.0, self.deadline - time.monotonic())
            self.time_left = math.ceil(self.remaining_seconds)
        self.deadline = None
        self.timer.stop()
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(False)

    def reset_timer(self):
        self.timer.stop()
        self.deadline = None
        self.remaining_seconds = None
        self.progress_bar.setStyleSheet("")
        self.is_working = True
        self.time_left = self.work_time
        self.total_time = self.work_time
        self.time_label.setText(f"{self.work_time // 60:02d}:00")
        self.status_label.setText("Çalışma zamanı")
        self.progress_bar.setValue(100)
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(False)

    def update_work_time(self, value):
        self.work_time = value * 60
        if self.is_working and not self.timer.isActive() and self.remaining_seconds is None:
            self.time_left = self.work_time
            self.total_time = self.work_time
            self.time_label.setText(f"{value:02d}:00")

    def update_break_time(self, value):
        self.break_time = value * 60

    def update_long_break_time(self, value):
        self.long_break_time = value * 60


    def rollover_day(self):
        today = date.today().isoformat()
        if today != self.day:
            self.day = today
            self.completed_today = 0
        self.stats_label.setText(f"Bugün tamamlanan: {self.completed_today}")

    def selected_task_id(self):
        item = self.task_list.currentItem()
        return item.data(Qt.UserRole) if item else None

    def refresh_tasks(self):
        selected = self.selected_task_id()
        queued = set(self.focus_queue.pending_ids())
        self.task_list.clear()
        for task in self.store.pending():
            item = QListWidgetItem(("• " if task.id in queued else "") + task.title)
            item.setData(Qt.UserRole, task.id)
            self.task_list.addItem(item)
            if task.id == selected:
                self.task_list.setCurrentItem(item)
        if self.active_task_id in self.store.tasks and not self.store.get(self.active_task_id).completed:
            self.focus_label.setText("Odak: " + self.store.get(self.active_task_id).title)
        else:
            self.active_task_id = None
            self.focus_label.setText("Odaklanılacak görev seçilmedi")

    def add_task(self):
        try:
            self.store.add(self.task_input.text())
        except ValueError:
            self.task_input.setPlaceholderText("Önce bir görev başlığı yaz")
            return
        self.task_input.clear()
        self.refresh_tasks()
        self.save_state()

    def complete_selected_task(self):
        task_id = self.selected_task_id()
        if task_id is not None:
            self.store.complete(task_id)
            self.refresh_tasks()
            self.save_state()

    def delete_selected_task(self):
        task_id = self.selected_task_id()
        if task_id is not None:
            self.store.remove(task_id)
            self.refresh_tasks()
            self.save_state()

    def undo_task(self):
        self.store.undo_remove()
        self.refresh_tasks()
        self.save_state()

    def queue_selected_task(self):
        task_id = self.selected_task_id()
        if task_id is not None:
            self.focus_queue.enqueue(task_id)
            self.refresh_tasks()
            self.save_state()

    def next_task(self):
        task = self.focus_queue.take_next()
        self.active_task_id = task.id if task else None
        self.refresh_tasks()
        self.save_state()

    def save_state(self):
        self.rollover_day()
        state = {
            "tasks": [asdict(task) for task in self.store.tasks.values()],
            "next_id": self.store.next_id,
            "queue": list(self.focus_queue.queue),
            "active": self.active_task_id,
            "durations": [self.work_spin.value(), self.break_spin.value(), self.long_break_spin.value()],
            "day": self.day, "completed": self.completed_today,
        }
        self.settings.setValue("state", json.dumps(state, ensure_ascii=False))
        self.settings.sync()
        if self.settings.status() != QSettings.NoError:
            self.stats_label.setText("Ayarlar kaydedilemedi. Disk erişimini kontrol et.")

    def load_state(self):
        try:
            state = json.loads(self.settings.value("state", "{}"))
            tasks = {}
            for row in state.get("tasks", []):
                task = Task(**row)
                if type(task.id) is not int or task.id < 1 or not isinstance(task.title, str) or type(task.completed) is not bool:
                    raise ValueError("Invalid task")
                tasks[task.id] = task
            next_id = max(int(state.get("next_id", 1)), max(tasks, default=0) + 1)
            durations = state.get("durations", [25, 5, 15])
            if len(durations) != 3 or any(type(value) is not int for value in durations):
                raise ValueError("Invalid durations")
            completed = max(0, int(state.get("completed", 0)))
            queue_ids = state.get("queue", [])
            if not isinstance(queue_ids, list) or any(type(value) is not int for value in queue_ids):
                raise ValueError("Invalid queue")
            active = state.get("active")
            if active is not None and type(active) is not int:
                raise ValueError("Invalid active task")
            self.store.tasks = tasks
            self.store.next_id = next_id
            for value, spin in zip(durations, (self.work_spin, self.break_spin, self.long_break_spin)):
                spin.setValue(value)
            for task_id in queue_ids:
                if task_id in tasks and not tasks[task_id].completed:
                    self.focus_queue.enqueue(task_id)
            self.active_task_id = active
            self.completed_today = completed if state.get("day") == self.day else 0
        except (ValueError, TypeError, KeyError, AttributeError):
            self.stats_label.setText("Kayıt okunamadı; varsayılan ayarlar açıldı.")
        self.refresh_tasks()
        self.rollover_day()

    def closeEvent(self, event):
        self.timer.stop()
        self.save_state()
        self.tray.hide()
        super().closeEvent(event)


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = ModernPomodoroTimer()
    window.show()
    sys.exit(app.exec_())
