# casa-franco-front-desk

Casa Franco gece resepsiyonu için iletişim sayfası, masa kartı ve yönetim paneli.
Misafir masadaki QR'ı okutur, WhatsApp'tan yazar. Cloudflare Worker olarak çalışır:
`public/` altındaki statik dosyalar + `src/` altındaki küçük bir API.

## Yapı

| Yol | Görev |
|---|---|
| `public/index.html` | Misafirin telefonunda açılan iletişim sayfası (TR/EN/RU) |
| `public/admin/` | Yönetim paneli (`/admin`): numara, vardiya, durum, duyuru |
| `public/print/desk-card.html` | A6 masa kartı, tarayıcıdan yazdırılır (QR kodlu) |
| `public/js/config.js` | **Yedek** ayarlar: API'ye ulaşılamazsa sayfa bunlarla çalışır |
| `public/js/i18n.js`, `contact.js`, `app.js` | Metinler, ortak hesaplar, sayfa davranışı |
| `public/css/style.css`, `assets/`, favicon'lar | Gece teması, logo, ikonlar |
| `public/vendor/qrcode.js` | qrcode-generator 1.4.4 (MIT); kart CDN'e bağlı kalmasın diye depoda |
| `src/worker.js` | İstek yönlendirme: `/api/*` + statik dosyalar, `/admin` güvenlik başlıkları |
| `src/site.js` | Ayar şeması, doğrulama, KV okuma/yazma |
| `src/session.js` | Panel oturumu: tek şifre, HMAC imzalı HttpOnly çerez, deneme sınırı |
| `wrangler.toml` | Worker adı, `public/` klasörü, KV bağlantısı |

### API

| Yol | Açıklama |
|---|---|
| `GET /api/config` | Canlı ayar (herkese açık). KV boşsa `{}` döner, sayfa yedeğe düşer. |
| `GET/POST/DELETE /api/admin/session` | Oturum durumu / giriş / çıkış |
| `PUT /api/admin/config` | Origin + oturum + girdi doğrulamasından sonra KV'ye yazar |

## Cloudflare kurulumu

1. **KV**: `casa-franco-site` deposu oluşturuldu, kimliği `wrangler.toml`'da.
2. **Repo bağlantısı**: Cloudflare → Workers & Pages → Create → Import a repository →
   bu repo. Deploy komutu `npx wrangler deploy`, build komutu boş.
3. **Secret**: Worker → Settings → Variables and Secrets → `ADMIN_PASSWORD`
   (Secret, en az 12 karakter; daha kısaysa panel açılmaz. Değiştirince tüm oturumlar düşer).
4. Site `casa-franco-front-desk.<hesap>.workers.dev` adresinde yayınlanır.

Bundan sonra `main`'e her push otomatik deploy olur.

### Turkcell notu

`*.vercel.app` adresleri Turkcell mobil veride açılmıyor; `*.pages.dev` için de Türkiye'de
engel haberi var. `workers.dev` adresi Turkcell'de test edilmeli. Kalıcı çözüm kendi alan
adı: alınınca `wrangler.toml`'daki `routes` satırı açılır, `public/js/config.js` içindeki
`siteUrl` değiştirilir ve **masa kartı yeniden basılır**.

## Güvenlik notları

- Hesap ya da API token'ı yok: Worker KV'ye doğrudan bağlanır.
- Giriş denemesi sınırı (15 dk'da 5) Worker örneğinin belleğinde tutulur; Cloudflare
  birden çok örnek çalıştırırsa sınır gevşer. Asıl koruma uzun, başka yerde kullanılmayan şifre.
- KV değişiklik geçmişi tutmaz; sadece son kaydın zamanı (`updatedAt`) saklanır.
- KV sonunda-tutarlıdır: panelden yapılan değişiklik en geç ~1 dakikada her yerde görünür.

## Yerelde çalıştırma

```sh
npm install
printf 'ADMIN_PASSWORD=en-az-on-iki-karakter\n' > .dev.vars   # git'e girmez
npm run dev        # http://localhost:8787  (yerel KV ile)
```

Kartı yazdırırken: kâğıt boyutu A6 (ya da "Gerçek boyut"), kenar boşluğu "Yok",
"Arka plan grafikleri" açık.
