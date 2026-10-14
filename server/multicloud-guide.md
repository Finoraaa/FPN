# 🌐 Çoklu Bulut (Multi-Cloud) & Yedek Çıkış Rehberi

FPN'in birincil omurgası Cloudflare Workers'tır. Ancak aşırı sansür durumlarında veya Cloudflare'ın tamamen yavaşlatılması ihtimaline karşı **Vercel Edge**, **Deno Deploy** veya **Kendi VPS'iniz (Reality/Hysteria 2)** yedek hat olarak devreye sokulabilir.

---

## 1. ⚡ Vercel Edge Functions ile Yedek VLESS Sunucusu

Vercel, dünya genelinde 100'den fazla Edge lokasyonuna sahiptir ve AWS Lambda / Cloudflare ile benzer omurgayı kullanır.

1. [vercel.com](https://vercel.com/) adresinden ücretsiz bir hesap oluşturun (GitHub ile bağlanabilirsiniz).
2. Yeni bir proje oluşturup `server/worker.js` kodunu bir Edge Route olarak dağıtın.
3. Vercel size `https://fpn-backup.vercel.app` şeklinde bir alan adı verir.
4. Bu alan adını FPN Desktop ve Mobil uygulamasında **"Sunucular -> Manuel Ekle"** diyerek ekleyin.

---

## 2. 🦕 Deno Deploy ile Sıfır Maliyetli Yedek Sunucu

Deno Deploy, Cloudflare Workers'a en yakın standart Web API uyumlu edge sunucusudur.

1. [deno.com/deploy](https://deno.com/deploy) adresine gidin.
2. Yeni bir **Playground** veya **GitHub Projesi** başlatın.
3. VLESS WebSocket kodunu yapıştırıp kaydedin.
4. Elde ettiğiniz `.deno.dev` alan adını FPN'e ikinci yedek düğüm olarak tanımlayın.

---

## 3. 🚀 Üst Düzey Hız: Kendi VPS'inizde Hysteria 2 / VLESS Reality

Eğer ücretsiz Cloudflare sınırlarını (örneğin aşırı yüksek UDP oyun pingi veya bant genişliği kısıtlaması) aşmak isterseniz:

* **Hysteria 2:** QUIC (UDP) tabanlıdır. Türkiye'deki kötü veya paket kaybı yaşayan internet hatlarında hız kaybını %0'a indirir.
* **VLESS Reality:** Kendi domain veya sertifikanıza ihtiyaç duymadan, trafiği `www.microsoft.com` veya `www.apple.com` gibi gösterir. DPI makineleri trafiği asla ayırt edemez.

FPN Masaüstü ve Mobil istemcisi hem Reality hem de standart VLESS protokollerini doğrudan destekleyecek şekilde tasarlanmıştır.
