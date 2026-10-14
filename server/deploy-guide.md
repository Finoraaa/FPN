# 🌐 FPN Cloud Serverless Kurulum Rehberi (Cloudflare)
Bu rehber, **FPN (Freedom Private Network)** için ömür boyu **%100 ÜCRETSİZ** ve **sansürlenemez** bir çıkış noktası kurmanızı sağlar.

---

### 🚀 Neden Cloudflare Workers?
1. **0 TL Maliyet:** Sunucu kiralamaya, kredi kartına veya fatura ödemeye gerek yoktur.
2. **DPI ve Sansür Geçirmez:** Türkiye'deki (ve diğer sansürcü ülkelerdeki) DPI mekanizmaları Cloudflare trafiğini engelleyemez. Çünkü dünya internetinin %20'si Cloudflare arkasındadır; engellemeye kalkışırlarsa yarım internet çöker.
3. **Küresel Hız:** Cloudflare'ın İstanbul ve küresel Edge sunucuları üzerinden ultra düşük gecikme.

---

### YÖNTEM 1: Web Arayüzü ile 2 Dakikada Kurulum (Önerilen)

1. **Cloudflare Hesabı Açın:**
   - [dash.cloudflare.com](https://dash.cloudflare.com/) adresine gidin ve ücretsiz bir hesap açın (Kredi kartı gerekmez).

2. **Worker Oluşturun:**
   - Sol menüden **Workers & Pages** bölümüne tıklayın.
   - **Create Application** (Uygulama Oluştur) butonuna basın.
   - **Create Worker** butonunu seçin.
   - İsim olarak `fpn-node` yazıp **Deploy** (Dağıt) deyin.

3. **Kodu Yapıştırın:**
   - Açılan ekranda **Edit code** (Kodu Düzenle) butonuna tıklayın.
   - Sol taraftaki editörde var olan her şeyi silin.
   - Projenizdeki `server/worker.js` dosyasının **tüm içeriğini** kopyalayıp buraya yapıştırın.
   - Sağ üstteki **Save and Deploy** (Kaydet ve Dağıt) butonuna tıklayın.

4. **Tebrikler, FPN Sunucunuz Hazır!**
   - Size verilen adresi kopyalayın (Örn: `https://fpn-node.kullaniciadi.workers.dev`).
   - Bu adrese tarayıcınızdan sonuna UUID ekleyerek gidin:
     `https://fpn-node.kullaniciadi.workers.dev/d342d11e-d424-4583-b36e-524ab1f0afa4`
   - Ekranda mobil QR kodunuz ve bağlantı linkiniz belirecektir!

---

### YÖNTEM 2: Terminal (Wrangler CLI) ile Kurulum

Eğer terminalden tek komutla kurmak isterseniz:
```bash
cd "/home/furkand/Masaüstü/My vpn/server"
npx wrangler login
npx wrangler deploy
```

---

### 🛡️ İpucu: workers.dev Alan Adı Engellenirse Ne Yapılır? (Clean IP Çözümü)
Bazı ISP'ler `workers.dev` alan adını engellemeye çalışabilir. Bu durumda:
1. Cloudflare Dashboard'dan Worker'ınıza ücretsiz bir alt alan adı (Custom Domain, örn: `vpn.seninsiten.com`) bağlayabilirsiniz.
2. Veya FPN Masaüstü istemcisindeki **Clean IP (Temiz IP)** özelliğini açarak doğrudan engelsiz Cloudflare CDN IP'leri üzerinden bağlanabilirsiniz.
