# 📱 FPN Mobil Kurulum Rehberi (Android & iPhone)

FPN (Freedom Private Network), bilgisayarınızda kurduğunuz Cloudflare VLESS altyapısını **telefonunuzda da tamamen ücretsiz ve sınırsız** olarak kullanmanızı sağlar.

---

## 🤖 Android Kurulumu

### ⚡ Yöntem 1: FPN Mobil APK (Özel Uygulamamız)
Proje için özel olarak derlenen yerleşik V2Ray motoruna sahip FPN uygulamasını doğrudan kurabilirsiniz:
1. `mobile/FPN-Release.apk` dosyasını telefonunuza aktarın (USB kablosu, Telegram, Google Drive veya WhatsApp üzerinden).
2. Telefonda APK dosyasına dokunun ve **Yükle** deyin (Gerekirse "Bilinmeyen kaynaklardan yüklemeye izin ver" seçeneğini açın).
3. Uygulamayı açtığınızda hazır yüksek hızlı sunucular (Almanya, Hollanda, Fransa) listelenir.
4. **"BAĞLAN"** butonuna dokunun ve VPN iznine onay verin. Hepsi bu kadar!

---

### 🌐 Yöntem 2: v2rayNG ile Kullanım (Alternatif / Hafif Yöntem)
Google Play Store'dan veya GitHub'dan açık kaynaklı, reklamsız istemcilerden birini yükleyebilirsiniz:
* **v2rayNG (Önerilen):** [Google Play Linki](https://play.google.com/store/apps/details?id=com.v2ray.ang) veya [GitHub Releases](https://github.com/2dust/v2rayNG/releases)
* **sing-box for Android:** [Google Play Linki](https://play.google.com/store/apps/details?id=io.nekohasekai.sfa)

### 2. Adım: FPN Profilini Ekleyin
1. **v2rayNG** uygulamasını açın.
2. Sağ üst köşedeki **"+"** simgesine dokunun.
3. Seçeneklerden **"QR Kodunu Tara"** (Scan QR Code) deyin ve bilgisayarınızdaki FPN uygulamasında **"Telefona Aktar"** sekmesindeki QR kodu taratın.
   *(Alternatif: PC'deki linki kopyalayıp WhatsApp/Telegram ile kendinize attıysanız **"Panodan içe aktar"** seçeneğini de kullanabilirsiniz).*

### 3. Adım: Bağlanın
1. Eklenen **FPN-Cloud** sunucusuna dokunun (yeşil çizgi belirecektir).
2. Sağ alt köşedeki **V** (Bağlan) butonuna dokunun.
3. İlk seferde Android "VPN Bağlantı İsteği" izni ister, **"Tamam"** deyin.
4. **Tebrikler!** Artık telefonunuzda Discord, Instagram, Twitter, Roblox ve tüm engelli siteler tam hızda açılacaktır.

---

## 🍏 iPhone / iPad (iOS) Kurulumu

### 1. Adım: Uygulamayı İndirin
App Store'dan aşağıdaki ücretsiz VLESS uyumlu istemcilerden birini yükleyin:
* **FoXray (Önerilen - Ücretsiz):** App Store'da "FoXray" aratın veya [App Store](https://apps.apple.com/app/foxray/id6448325603)
* **Streisand (Alternatif - Ücretsiz):** [App Store](https://apps.apple.com/app/streisand/id6450534064)
* **Shadowrocket:** Eğer halihazırda satın aldıysanız tam uyumludur.

### 2. Adım: FPN Profilini Ekleyin
1. **FoXray** veya **Streisand** uygulamasını açın.
2. Sağ üstteki **"+"** simgesine veya kamera simgesine dokunun.
3. PC'nizdeki FPN ekranında açılan QR kodu kameranızla okutun.
4. Sunucu anında listenize eklenecektir.

### 3. Adım: Bağlanın
1. Ana ekrandaki büyük **"Play / Bağlan"** butonuna dokunun.
2. iOS'un "VPN Konfigürasyonu Eklemek İstiyor" uyarısına **"İzin Ver"** deyin ve Face ID / Parolanızı girin.
3. Üst barda **"VPN"** simgesi belirdiği anda tüm sansür kalkmıştır!

---

## 🛡️ Sık Karşılaşılan Sorunlar ve Çözümleri

### ❓ Soru: Mobil internetimde (Turkcell/Vodafone/TT) bağlanırken bazen gecikme oluyor?
* **Çözüm:** FPN Masaüstü uygulamasında veya profil ayarlarında **Clean IP (Temiz IP)** özelliğini açın. Sunucu IP'si olarak `104.16.132.229` veya `172.67.182.204` kullanarak operatörün alan adı bazlı filtrelemelerini tamamen baypas edebilirsiniz.

### ❓ Soru: Pil tüketimi nasıl?
* VLESS + WebSocket protokolü, eski OpenVPN protokollerine göre %80 daha az pil harcar. Telefonun arka planında donma veya ısınma yapmaz.
