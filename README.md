# casa-franco-front-desk

Casa Franco gece resepsiyonu için iletişim sayfası ve masa kartı. Misafir masadaki
QR'ı okutur, WhatsApp'tan yazar. Build adımı veya bağımlılık yoktur; düz statik dosyalardır.

## Yapı

| Yol | Görev |
|---|---|
| `index.html` | Misafirin telefonunda açılan iletişim sayfası (TR/EN/RU) |
| `print/desk-card.html` | A6 masa kartı, tarayıcıdan yazdırılır (QR kodlu) |
| `js/config.js` | **Tek ayar dosyası**: numara, vardiya, saat dilimi, site URL'si |
| `js/i18n.js` | Arayüz metinleri |
| `js/contact.js` | WhatsApp linki, vCard, "görevde mi" hesabı (sayfa + kart ortak) |
| `js/app.js` | Sayfa davranışı |
| `css/style.css` | Gece teması |
| `assets/logo.svg` | Logonun fotoğraftan yeniden çizilmiş hali (birebir değil) |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | Çan kulesi ikonu |
| `vendor/qrcode.js` | qrcode-generator 1.4.4 (MIT); kart CDN'e bağlı kalmasın diye depoda |

## Yayın öncesi kontrol

1. `js/config.js` içindeki `phone` tam olmalı. Eksikse sayfa üstte kırmızı uyarı,
   kart ise "yazdırmayın" katmanı gösterir.
2. Vardiya saatlerini doğrula (`shift`).
3. Sayfa yayına alındıktan sonra kalıcı URL'yi `siteUrl` alanına yaz ve kartı
   **ondan sonra** bas. Böylece numara değişse bile kartı yeniden basman gerekmez.

## Yerelde görüntüleme

```sh
python3 -m http.server 8000
# http://localhost:8000/ ve http://localhost:8000/print/desk-card.html
```

Kartı yazdırırken: kâğıt boyutu A6 (ya da "Gerçek boyut"), kenar boşluğu "Yok",
"Arka plan grafikleri" açık.
