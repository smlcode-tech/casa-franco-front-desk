# casa-franco-front-desk

Casa Franco gece resepsiyonu için iletişim sayfası, masa kartı ve yönetim paneli.
Misafir masadaki QR'ı okutur, WhatsApp'tan yazar. Build adımı ve npm bağımlılığı yoktur:
statik dosyalar + `api/` altında Vercel Node fonksiyonları.

## Yapı

| Yol | Görev |
|---|---|
| `index.html` | Misafirin telefonunda açılan iletişim sayfası (TR/EN/RU) |
| `print/desk-card.html` | A6 masa kartı, tarayıcıdan yazdırılır (QR kodlu) |
| `admin/` | Yönetim paneli (`/admin`) — numara, vardiya, durum, duyuru |
| `api/config.js` | `GET /api/config`: canlı ayar (herkese açık, ~10 sn CDN önbelleği) |
| `api/admin/session.js` | Panel girişi/çıkışı (tek şifre, imzalı HttpOnly çerez) |
| `api/admin/config.js` | `PUT`: doğrulanmış ayarı Edge Config'e yazar |
| `api/_lib/` | Ortak kod: şema/doğrulama, Edge Config erişimi, oturum |
| `js/config.js` | **Yedek** ayarlar: API'ye ulaşılamazsa sayfa bunlarla çalışır |
| `js/i18n.js` | Arayüz metinleri |
| `js/contact.js` | WhatsApp linki, vCard, "görevde mi" hesabı (sayfa + kart ortak) |
| `js/app.js` | Sayfa davranışı |
| `css/style.css` | Gece teması |
| `assets/logo.svg` | Logonun fotoğraftan yeniden çizilmiş hali (birebir değil) |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | Çan kulesi ikonu |
| `vendor/qrcode.js` | qrcode-generator 1.4.4 (MIT); kart CDN'e bağlı kalmasın diye depoda |

## Panel kurulumu (Vercel ortam değişkenleri)

| Değişken | Kim ayarlar | Not |
|---|---|---|
| `EDGE_CONFIG` | kuruldu | `casa-franco-site` Edge Config okuma bağlantısı |
| `VERCEL_TEAM_ID` | kuruldu | Edge Config'in bulunduğu takım |
| `ADMIN_PASSWORD` | **sen** | En az 12 karakter; daha kısaysa panel açılmaz. Değiştirince tüm oturumlar düşer. |
| `VERCEL_API_TOKEN` | **sen** | Vercel → Account Settings → Tokens; kapsamı bu takım. Edge Config'e yazmak için. |

İkisini Vercel → Project → Settings → Environment Variables'tan **Sensitive** olarak
ekle (Production), sonra son deploy'u **Redeploy** et; env değişkenleri yeni deploy'da okunur.

Güvenlik notları:
- Giriş denemesi sınırı (15 dk'da 5) fonksiyon örneğinin belleğinde tutulur; Vercel birden
  çok örnek açarsa sınır gevşer. Asıl koruma uzun, başka yerde kullanılmayan şifre.
- Edge Config değişiklik geçmişi tutmaz; sadece son kaydın zamanı (`updatedAt`) saklanır.

## Yayın öncesi kontrol

1. Canlı değerler panelden yönetilir; `js/config.js` yedektir ama yine de güncel tut. `phone` tam olmalı. Eksikse sayfa üstte kırmızı uyarı,
   kart ise "yazdırmayın" katmanı gösterir.
2. Vardiya saatlerini doğrula (`shift`).
3. Sayfa yayına alındıktan sonra kalıcı URL'yi `siteUrl` alanına yaz ve kartı
   **ondan sonra** bas. Böylece numara değişse bile kartı yeniden basman gerekmez.

## Yerelde görüntüleme

```sh
python3 -m http.server 8000
# http://localhost:8000/ ve http://localhost:8000/print/desk-card.html
```

Statik sunucu `/api` fonksiyonlarını çalıştırmaz; sayfa bu durumda yedek ayarlarla açılır.
Panel dahil tam deneme için `vercel dev` gerekir.

Kartı yazdırırken: kâğıt boyutu A6 (ya da "Gerçek boyut"), kenar boşluğu "Yok",
"Arka plan grafikleri" açık.
