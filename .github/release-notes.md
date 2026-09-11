Pomodro'nun ilk masaüstü sürümü.

- Windows x64 ve macOS Apple Silicon paketleri.
- Çalışma/kısa mola/uzun mola sayacı; duraklatma ve devam etme.
- Görev ekleme, tamamlama, silme ve geri alma.
- FIFO odaklanma kuyruğu ve sıradaki göreve geçme.
- Kalıcı görevler, ayarlar ve günlük seans sayısı.
- Sistem sesi ve desteklenen ortamlarda masaüstü bildirimleri.

**Windows:** `pomodoro-windows-x64.zip` dosyasının tamamını çıkarıp `Pomodoro/Pomodoro.exe` dosyasını aç. `_internal` klasörünü yanında tut; Python gerekmez.

**macOS:** `pomodoro-macos-arm64.zip` içindeki uygulamayı Applications'a taşı.

Paketler geliştirici sertifikasıyla imzalanmamıştır. 44 otomatik test ile Windows Server 2022 ve macOS runner'larında paketleme/açılış kontrolleri uygulanır. Gerçek Windows 11 cihazındaki ses, bildirim izinleri ve yüksek DPI davranışı ayrıca kontrol edilmelidir. Uyku süresinin sayaca yansıması platformun monotonik saatine bağlıdır.

Silme geçmişi uygulama kapanınca sıfırlanır; aktif sayaç yeniden açılışta devam etmez. Lisans: GPLv3.
