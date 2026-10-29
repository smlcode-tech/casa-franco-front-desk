/*
 * Canlı site ayarının (Edge Config'teki "site" anahtarı) şeması, doğrulaması
 * ve okuma/yazma erişimi. Hem herkese açık okuma endpoint'i (api/config.js)
 * hem panelin yazma endpoint'i (api/admin/config.js) bunu kullanır.
 * "_" ile başlayan klasör Vercel tarafından fonksiyon olarak yayınlanmaz.
 */

const EDGE_KEY = 'site';
const LANGS = ['tr', 'en', 'ru'];
const ANNOUNCEMENT_MAX = 200;

/**
 * Eksik ortam değişkeni için ayrı hata türü. Endpoint bunu tanıyıp panele
 * hangi değişkenin eksik olduğunu söyler; önceden eksik VERCEL_API_TOKEN
 * "Bearer undefined" olarak gönderiliyor ve Vercel'den anlamsız bir 404 dönüyordu.
 */
export class MissingEnvError extends Error {
  constructor(name) {
    super(`${name} tanımlı değil`);
    this.envName = name;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new MissingEnvError(name);
  return value;
}

/**
 * EDGE_CONFIG bağlantı adresinden (https://edge-config.vercel.com/<id>?token=...)
 * store kimliğini ve okuma token'ını ayırır. Ayrı env değişkeni tutmamak için
 * Vercel'in standart bağlantı biçimi tek kaynak olarak kullanılıyor.
 */
function edgeConnection() {
  const url = new URL(requireEnv('EDGE_CONFIG'));
  return { id: url.pathname.replace(/^\//, ''), token: url.searchParams.get('token') };
}

/** Kayıtlı ayarı okur; hiç kaydedilmemişse null döner. */
export async function readSite() {
  const { id, token } = edgeConnection();
  const res = await fetch(`https://edge-config.vercel.com/${id}/item/${EDGE_KEY}?token=${token}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Edge Config okuma hatası: ${res.status}`);
  return res.json();
}

/**
 * Ayarı yazar. Edge Config'in okuma token'ı yazamaz; yazma için Vercel hesap
 * token'ı (VERCEL_API_TOKEN) gerekir, bu yüzden bu yol sadece oturum
 * doğrulandıktan sonra çağrılır.
 * Vercel, Edge Config'i "Global Config" olarak yeniden adlandırdı; eski
 * /v1/edge-config/... yazma adresi production'da 404 döndü, güncel adres kullanılıyor.
 */
export async function writeSite(value) {
  const { id } = edgeConnection();
  // İstek göndermeden önce kontrol edilir: token yoksa Vercel'e gitmenin anlamı yok.
  const apiToken = requireEnv('VERCEL_API_TOKEN');
  const team = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';
  const res = await fetch(`https://api.vercel.com/v1/global-config/${id}/items${team}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ items: [{ operation: 'upsert', key: EDGE_KEY, value }] })
  });
  if (!res.ok) {
    // Vercel'in hata kodu (ör. not_found, forbidden) loga yazılır: 404'ün yanlış
    // adres mi yoksa yanlış kapsamlı token mı olduğunu ayırt etmenin tek yolu bu.
    // Cevap gövdesi token içermez; yine de uzunluğu sınırlanır.
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Edge Config yazma hatası: ${res.status} ${detail}`);
  }
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
