# pomodro

A minimal, distraction-free Pomodoro timer built for Windows and macOS.

## Why I Built It

Back in 2025, while trying to build a better daily workflow and stay focused, I spent a lot of time watching videos and reading articles on deep work. When looking for a tool, most options felt either overly cluttered, full of distractions, or tied behind subscriptions.

I just wanted something clean: queue up tasks, focus on one thing at a time, and get a gentle nudge when it's time to take a break. So, I built `pomodro` to solve my own problem. It's been part of my routine ever since, and I'm sharing it here for anyone looking for that same simplicity.

---

## Download

Grab the latest builds on the **[Releases](https://github.com/knuznr/pomodro/releases/latest)** page:

- **Windows (x64):** Download `pomodoro-windows-x64.zip`, extract it to a folder, and launch `Pomodoro.exe` (keep the `_internal` folder in the same directory). No Python installation required.
- **macOS (Apple Silicon):** Unzip `pomodoro-macos-arm64.zip` and drag `Pomodoro.app` into your Applications folder.

> **Note:** Binaries are not signed with paid developer certificates, so your OS may show an initial security prompt on first launch.

---

## Features & Philosophy

- **Simple Intervals:** 25-minute focus blocks, short breaks, and an extended break every four sessions (all durations customizable).
- **Task Queue:** Add, arrange, and hit **Next** to move through your focus list.
- **Persistent State:** Tasks, queue order, timers, and total daily focus time are saved automatically.
- **Gentle Alerts:** Native system chime and desktop notifications when sessions end.

**Intentional Design**  
The app avoids making assumptions for you. Selecting a task won’t auto-start the timer, and an expiring timer won’t mark your task as done. You stay in control: start sessions with **Start**, take your break, and hit **Complete** when you're truly finished.

---

## Running from Source

Requires Python 3.12+.

**Windows (PowerShell):**
```powershell
git clone [https://github.com/knuznr/pomodro.git](https://github.com/knuznr/pomodro.git)
cd pomodro
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe app.py

```

**macOS:**

```sh
git clone [https://github.com/knuznr/pomodro.git](https://github.com/knuznr/pomodro.git)
cd pomodro
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python app.py

```

---

## Testing & Packaging

With the virtual environment active:

```sh
python -m pytest -q
python -m PyInstaller --clean --noconfirm "Pomodoro Timer.spec"
```

*Note: Windows builds are generated on Windows, and macOS builds on macOS. The repository includes GitHub Actions workflows on Python 3.12 to run test suites and smoke-test app launch sanity automatically.*

---

## License

Distributed under the **GPL-3.0** License. See [LICENSE](https://www.google.com/search?q=LICENSE) for details.

Built with PyQt5 and Qt. Dependency licensing terms: [PyQt License](https://www.riverbankcomputing.com/software/pyqt) | [Qt License](https://doc.qt.io/qt-5/licensing.html)