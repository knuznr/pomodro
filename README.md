# pomodro

Windows ve macOS için sade bir Pomodoro uygulaması. Görevlerini sıraya koy, tek işe odaklan, molanı zamanında ver.

## İndir

**[En güncel sürüm](https://github.com/knuznr/pomodro/releases/latest)**

- **Windows x64:** `pomodoro-windows-x64.zip` dosyasını indir, tamamını bir klasöre çıkar ve `Pomodoro.exe` dosyasını aç. `_internal` klasörünü yanında tut. Python kurman gerekmez.
- **macOS / Apple Silicon:** `pomodoro-macos-arm64.zip` dosyasını çıkar ve `Pomodoro.app` dosyasını Applications klasörüne taşı.

Paketler geliştirici sertifikasıyla imzalanmamıştır. Windows veya macOS ilk açılışta güvenlik uyarısı gösterebilir.

## Neler yapar?

- Ayarlanabilir çalışma, kısa mola ve her dört çalışma sonrası uzun mola.
- Başlat, duraklat, devam et ve sıfırla.
- Görev ekle, tamamla, sil ve son silinenleri geri al.
- Görevleri odaklanma sırasına koy; **Sıradaki** ile sıradaki uygun göreve geç.
- Görevler, sıra, seçili görev, süre ayarları ve günlük toplam otomatik kaydedilir.
- Seans bitişinde sistem sesi ve desteklenen ortamlarda masaüstü bildirimi.

Görev seçmek sayacı otomatik başlatmaz. Seans bitişi de görevi otomatik tamamlamaz; görevini seçip **Tamamla** düğmesini kullanabilirsin. Mola ve çalışma seanslarını **Başlat** ile başlatırsın.

Silme geçmişi yalnızca açık oturumda tutulur. Uygulama yeniden açıldığında sayaç yeni bir çalışma seansıyla başlar. Günlük toplam yerel tarihe göre hesaplanır. Sistem uykusundan sonra platformun monotonik saat davranışına göre kalan süre değişebilir; geçmiş seanslar otomatik zincir halinde sayılmaz.

## Kaynaktan çalıştır

Python 3.12 veya üzeri.

Windows PowerShell:

```powershell
git clone https://github.com/knuznr/pomodro.git
cd pomodro
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe app.py
```

macOS:

```sh
git clone https://github.com/knuznr/pomodro.git
cd pomodro
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python app.py
```

## Test ve paketleme

Sanal ortam etkinken:

```sh
python -m pytest -q
python -m PyInstaller --clean --noconfirm "Pomodoro Timer.spec"
```

Windows paketi Windows'ta, Mac paketi macOS'te üretilir. GitHub Actions Python 3.12 ile test, paketleme ve paketlenmiş uygulamada beş saniyelik açılış kontrolü yapar. Windows CI ortamı Windows Server 2022 x64, macOS ortamı Apple Silicon'dır. Bu otomasyon gerçek Windows 11 cihazında bildirim ve ekran ölçeği kontrolünün yerine geçmez.

## Lisans

GPL-3.0; ayrıntılar [LICENSE](LICENSE) dosyasında.

PyQt5 ve Qt kullanır. PyQt5 GPLv3/ticari, Qt ise bileşenlerine göre LGPL/GPL/ticari koşullarla sunulur. Dağıtılan bağımlılıkların lisans dosyaları paket içinde korunur. [PyQt lisansı](https://www.riverbankcomputing.com/software/pyqt), [Qt lisansı](https://doc.qt.io/qt-5/licensing.html).
