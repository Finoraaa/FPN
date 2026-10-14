# 🛡️ FPN (Freedom Private Network)
> **%100 Ücretsiz, Sıfır Maliyetli, Hem PC Hem Telefon İçin DPI & Sansür Geçirmez VPN Ekosistemi**

---

## 🌟 Neden FPN? (Nasıl Sansürden Kaçar?)
Standart VPN protokolleri (OpenVPN, düz WireGuard) Türkiye'de ve sansürcü ülkelerde **DPI (Derin Paket İncelemesi)** tarafından el sıkışma imzalarından tanınır ve saniyeler içinde engellenir veya hızı kısılır.

**FPN'in Üstün Özellikleri:**
1. **Cloudflare Edge Omurgası (0 TL Sunucu Maliyeti):** Trafiği Cloudflare'ın küresel sunucuları üzerinden taşır. ISP'ler Cloudflare'ı engelleyemez çünkü dünya internetinin %20'si bu IP'lerdedir.
2. **VLESS + WebSocket + TLS 1.3:** Ağ trafiğinizi meşru bir HTTPS web gezintisi gibi gösterir; DPI makineleri için normal web trafiğinden farksızdır.
3. **Clean IP Tarayıcısı & Desteği:** Alan adı (`workers.dev`) engellense bile Türkiye'deki en hızlı ve sansürsüz Cloudflare Anycast IP'lerini tek tıkla tarayıp doğrudan IP üzerinden bağlanır.
4. **Bölünmüş Tünel (Split Tunneling - PC & Mobil):** Bankalar (Akbank, Garanti, İşCep vb.), e-Devlet ve yerel Türk siteleri/uygulamaları VPN'e girmeden tam hızda açılır; Discord, Roblox vb. şifreli tünelden geçer.
5. **Dahili Hız Testi (Cloudflare Speedtest):** Doğrudan Cloudflare CDN omurgası üzerinden indirme hızı (Mbps) ve gecikmeyi ölçer.
6. **Reklam & Takipçi Engelleme (AdBlock):** sing-box çekirdeğinde geosite filtreleme ile tüm web sitelerinde reklamları engeller.
7. **Ağ Doktoru (Acil Kurtarma):** İnternet veya proxy takıldığında tek tıkla tüm DNS ve sistem ayarlarını fabrika durumuna sıfırlar.
8. **Sistem Tepsisi (System Tray):** Pencere kapatıldığında arka planda sessizce çalışmaya devam eder.
9. **Abonelik Linki (Subscription URL):** Tek tıkla toplu v2ray/VLESS sunucu listelerini çeker ve otomatik günceller.
10. **Kill Switch & Akıllı Ping:** Mobil ve masaüstünde bağlantı koparsa sızıntıyı engeller, en düşük pingli sunucuya otomatik bağlanır.

---

## 📂 Proje Yapısı

```
My vpn/
├── run.sh                  # PC için tek tıkla FPN başlatıcı
├── FPN.desktop             # Linux masaüstü kısayolu
├── bin/
│   └── sing-box            # Yüksek performanslı Go çekirdeği (v1.14.3)
├── server/
│   ├── worker.js           # Cloudflare Edge VLESS sunucu kodu
│   ├── deploy-guide.md     # 2 dakikada Cloudflare kurulum rehberi
│   └── wrangler.toml       # CLI dağıtım yapılandırması
├── client/
│   ├── server.js           # Yerel Node.js backend denetleyicisi
│   ├── data/               # Sunucu ve ayar veritabanı (JSON)
│   └── public/             # Cyberpunk / Glassmorphic masaüstü arayüzü
│       ├── index.html
│       ├── css/style.css
│       └── js/app.js
├── mobile/
│   └── mobile-guide.md     # Android (v2rayNG) ve iPhone (FoXray/Streisand) rehberi
└── scripts/
    └── set-system-proxy.sh # KDE 6 ve GNOME sistem proxy otomasyonu
```

---

## 🚀 1. Adım: Ücretsiz Cloudflare Sunucunuzu Kurun (2 Dakika)

1. [dash.cloudflare.com](https://dash.cloudflare.com/) adresine gidin ve ücretsiz bir hesap açın (Kredi kartı gerekmez).
2. **Workers & Pages** -> **Create Application** -> **Create Worker** deyin.
3. İsim verip **Deploy**'a basın, ardından **Edit Code** butonuna tıklayın.
4. Projenizdeki `server/worker.js` dosyasının **tümünü** yapıştırıp **Save and Deploy** deyin.
5. Size verilen Worker adresini kopyalayın (Örn: `fpn-node.kullaniciadi.workers.dev`).
6. *Ayrıntılı adımlar için:* [server/deploy-guide.md](file:///home/furkand/Masaüstü/My vpn/server/deploy-guide.md)

---

## 💻 2. Adım: PC'de FPN İstemcisini Başlatın

Masaüstünde veya terminalde şu komutu çalıştırmanız yeterlidir:
```bash
cd "/home/furkand/Masaüstü/My vpn"
./run.sh
```
* Tarayıcınızda `http://127.0.0.1:4040` adresinde modern FPN arayüzü otomatik olarak açılacaktır.
* **Sunucular** sekmesinden kendi Cloudflare Worker adresinizi ekleyin veya varsayılanı kullanın.
* Dev **BAĞLAN** butonuna basın: FPN hem sing-box şifreleme tünelini başlatır hem de Linux KDE/GNOME masaüstü proxy'nizi otomatik ayarlar!

---

## 📱 3. Adım: Telefonunuzu Bağlayın

1. PC arayüzünde **"Telefona Aktar"** sekmesine gelin.
2. Ekranda beliren QR kodu telefonunuzla tarayın:
   * **Android:** Google Play'den **v2rayNG** yükleyin -> Sağ üstteki `+` -> *QR Kodunu Tara*.
   * **iPhone / iPad:** App Store'dan **FoXray** veya **Streisand** yükleyin -> `+` -> *QR Kod Tara*.
3. Bağlan butonuna basın. Telefonunuzda da tüm sansür anında kalkar!
4. *Ayrıntılı rehber için:* [mobile/mobile-guide.md](file:///home/furkand/Masaüstü/My vpn/mobile/mobile-guide.md)
