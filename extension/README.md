# 🛡️ FPN (Freedom Private Network) - Web Browser Extension

Tarayıcınızın araç çubuğunda (toolbar) tek tıkla sansürsüz ve şifreli internete bağlanmanızı sağlayan **FPN Web Eklentisi** (Chrome, Brave, Edge, Zen ve Firefox uyumlu).

---

## 🚀 1 Dakikada Kurulum

### 1. Google Chrome / Brave / Microsoft Edge / Opera (Chromium Tabanlılar)
1. Tarayıcınızın adres çubuğuna şunu yazın ve `Enter`a basın:
   - **Chrome:** `chrome://extensions`
   - **Brave:** `brave://extensions`
   - **Edge:** `edge://extensions`
2. Sağ üst köşedeki **"Geliştirici modu" (Developer mode)** anahtarını açın.
3. Sol üstte beliren **"Paketlenmemiş öğe yükle" (Load unpacked)** butonuna tıklayın.
4. Açılan dosya penceresinde projedeki şu klasörü seçin:
   ```bash
   /home/furkand/Masaüstü/My vpn/extension
   ```
5. Eklenti anında tarayıcınıza yüklenecektir! Araç çubuğundaki yapboz (Puzzle) simgesine basıp FPN'i sabitleyin (Pin).

---

### 2. Firefox & Zen Browser (Gecko Tabanlılar)
1. Adres çubuğuna `about:debugging` yazıp `Enter`a basın.
2. Sol menüden **"Bu Firefox" (This Firefox / This Zen)** sekmesine tıklayın.
3. **"Geçici Eklenti Yükle..." (Load Temporary Add-on...)** butonuna tıklayın.
4. Şu dosyayı seçin:
   ```bash
   /home/furkand/Masaüstü/My vpn/extension/manifest.json
   ```
5. Eklenti anında araç çubuğunuza eklenecektir!

---

## ✨ Özellikler

- **⚡ Tek Tıkla Bağlan / Kes:** Tarayıcınızı açtığınızda masaüstü arayüzünü aramadan doğrudan adres çubuğunun yanından VPN'i kontrol edin.
- **🎯 Çıkış Sunucusu Seçimi:** Kayıtlı VLESS / Shadowsocks / Trojan sunucularınız arasında geçiş yapın.
- **🚀 Akıllı Bağlan (Smart Connect):** En düşük gecikmeli (ping) sunucuyu otomatik test edip tek tıkla bağlanın.
- **🟢 Canlı Durum & Badge:** Bağlantı açık olduğunda eklenti simgesi üzerinde yeşil `ON` rozeti belirir.
- **🛡️ İkili Çalışma Modu:**
  - **FPN Core Modu:** Masaüstü FPN backend'i (`127.0.0.1:4040`) açıkken tünel başlatma, ping kontrolü ve sunucu geçişleri tam senkronize çalışır.
  - **Doğrudan Tarayıcı Proxy Modu:** Masaüstü uygulaması kapalı olsa bile tarayıcının yerel SOCKS5 tünelini (`127.0.0.1:2080`) anında açıp kapatabilir.
- **💖 Destek & Bağış:** Projeye tek tıkla destek olma kısayolu.
