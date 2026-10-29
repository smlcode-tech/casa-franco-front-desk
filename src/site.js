/*
 * Canlı site ayarının (KV'deki "site" anahtarı) şeması, doğrulaması ve
 * okuma/yazma erişimi. Worker'ın hem herkese açık okuma yolu (/api/config)
 * hem panelin yazma yolu (/api/admin/config) bunu kullanır.
 *
 * Vercel'den taşındı: Edge Config'e yazmak takım çapında yetkili bir hesap
 * token'ı gerektiriyordu; KV ise Worker'a doğrudan bağlanır (binding),
 * hiçbir API token'ı tutulmaz.
 */

const SITE_KEY = 'site';
const LANGS = ['tr', 'en', 'ru'];
const ANNOUNCEMENT_MAX = 200;

/**
 * Eksik ayar (binding ya da secret) için ayrı hata türü. Worker bunu tanıyıp
 * panele hangi ayarın eksik olduğunu söyler; Vercel'de eksik token yanıltıcı
 * bir 404'e dönüşmüş ve iki tur yanlış teşhise yol açmıştı.
 */
export class MissingEnvError extends Error {
  constructor(name) {
    super(`${name} tanımlı değil`);
    this.envName = name;
  }
}

function kv(env) {
  if (!env.SITE_KV) throw new MissingEnvError('SITE_KV');
  return env.SITE_KV;
}

/** Kayıtlı ayarı okur; panelden hiç kaydedilmemişse null döner. */
export async function readSite(env) {
  return kv(env).get(SITE_KEY, 'json');
}

/**
 * Ayarı yazar. KV sonunda-tutarlıdır: yazılan değerin tüm Cloudflare
 * lokasyonlarında görünmesi 60 saniyeye kadar sürebilir.
 */
export async function writeSite(env, value) {
  await kv(env).put(SITE_KEY, JSON.stringify(value));
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Panelden gelen gövdeyi doğrular ve sadece bilinen alanları içeren temiz
 * bir nesne döndürür. Numara alanı en kritik alan: biri onu değiştirirse
 * misafir mesajları başkasına gider. Bu yüzden sadece TR cep formatı kabul edilir.
 * Hata varsa { errors } döner.
 */
export function validateSite(body) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};

  const phone = String(b.phone ?? '').replace(/[\s()-]/g, '');
  if (!/^\+905\d{9}$/.test(phone)) errors.push('phone');

  const start = String(b.shift?.start ?? '');
  const end = String(b.shift?.end ?? '');
  if (!HHMM.test(start) || !HHMM.test(end) || start === end) errors.push('shift');

  // auto: saate göre hesapla; off: bu gece görevde değilim (hastalık, izin).
  const status = b.status === 'off' ? 'off' : b.status === 'auto' ? 'auto' : null;
  if (!status) errors.push('status');

  const announcement = {};
  for (const lang of LANGS) {
    // Sayfa duyuruyu textContent ile basıyor; yine de kontrol karakterleri temizleniyor.
    const text = String(b.announcement?.[lang] ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (text.length > ANNOUNCEMENT_MAX) errors.push(`announcement.${lang}`);
    announcement[lang] = text;
  }

  if (errors.length) return { errors };
  return {
    value: { phone, shift: { start, end }, status, announcement, updatedAt: new Date().toISOString() }
  };
}
