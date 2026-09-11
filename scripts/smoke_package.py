"""Launch the frozen app, check it stays alive, then close it (CI smoke check)."""
import subprocess
import sys
from pathlib import Path

executable = Path(sys.argv[1]).resolve(strict=True)
process = subprocess.Popen([str(executable)], cwd=executable.parent)
try:
    try:
        code = process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        print('Packaged application stayed running for 5 seconds.')
    else:
        raise SystemExit(f'Application exited during startup: {code}')
finally:
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
