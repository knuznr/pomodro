# Build on the target OS: python -m PyInstaller --clean --noconfirm "Pomodoro Timer.spec"
import sys

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[("LICENSE", "."), ("README.md", ".")],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Pomodoro',
    debug=False,
    strip=False,
    upx=False,
    console=False,
)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='Pomodoro')
if sys.platform == 'darwin':
    app = BUNDLE(coll, name='Pomodoro.app', icon=None,
                 bundle_identifier='io.pomodro.timer')
