/*
 * Panel oturumu: tek şifreyle giriş, HMAC imzalı HttpOnly çerez.
 * Kullanıcı tablosu yok; panele sadece tek kişi (gece resepsiyonisti) giriyor.
 *
 * Vercel'den taşındı: Node'un crypto modülü yerine Cloudflare Workers'ın
 * Web Crypto API'si kullanılıyor. Çerez biçimi ve kontroller aynı kaldı.
 */

const COOKIE = 'cf_admin';
const TTL_SECONDS = 12 * 60 * 60; // bir vardiya + pay
const MIN_PASSWORD_LENGTH = 12;
const encoder = new TextEncoder();

async function sha256(text) {
  return crypto.subtle.digest('SHA-256', encoder.encode(text));
}

function base64url(buffer) {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * İmza anahtarı şifreden türetilir: şifre değiştirilince açık oturumların
 * hepsi kendiliğinden geçersiz olur, ayrıca bir secret yönetmek gerekmez.
 */
async function sign(env, payload) {
  const raw = await sha256(`cf-session:${env.ADMIN_PASSWORD}`);
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

// timingSafeEqual eşit uzunluk ister; girdiler önce özetlenerek uzunluk farkı ve
// içerik hakkında zamanlamadan bilgi sızması engellenir. Workers'a özgü bir API.
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

/** Zayıf ya da tanımsız şifreyle panelin hiç açılmaması için ön koşul. */
export function isConfigured(env) {
  return typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length >= MIN_PASSWORD_LENGTH;
}

export async function checkPassword(env, input) {
  return isConfigured(env) && safeEqual(String(input ?? ''), env.ADMIN_PASSWORD);
}

export async function sessionCookie(env) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const value = `${exp}.${await sign(env, String(exp))}`;
  // Path=/api/admin: çerez misafir sayfasının isteklerine hiç eklenmez.
  return `${COOKIE}=${value}; Path=/api/admin; Max-Age=${TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export async function hasValidSession(env, request) {
  if (!isConfigured(env)) return false;
  const match = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!match) return false;
  const [exp, sig] = match[1].split('.');
  if (!exp || !sig || !(await safeEqual(sig, await sign(env, exp)))) return false;
  return Number(exp) > Date.now() / 1000;
}

/**
 * CSRF koruması: SameSite=Strict'e ek olarak, durum değiştiren isteklerde
 * Origin başlığının sitenin kendi adresi olması şart koşulur.
 */
export function isSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/*
 * Kaba kuvvet denemelerini yavaşlatmak için IP başına sayaç.
 * Sınırlama: sayaç Worker örneğinin belleğinde tutulur; Cloudflare birden çok
 * örnek çalıştırırsa her biri ayrı sayar. Asıl koruma uzun şifre (en az 12 karakter).
 */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function clientIp(request) {
  // CF-Connecting-IP'yi Cloudflare kendisi yazar; istemci tarafından taklit edilemez.
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

export function isRateLimited(request) {
  const entry = attempts.get(clientIp(request));
  if (!entry || Date.now() - entry.first > WINDOW_MS) return false;
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailure(request) {
  const ip = clientIp(request);
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first > WINDOW_MS) attempts.set(ip, { first: now, count: 1 });
  else entry.count += 1;
}
