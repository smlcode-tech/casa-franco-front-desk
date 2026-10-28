/*
 * Panel oturumu: tek şifreyle giriş, HMAC imzalı HttpOnly çerez.
 * Kullanıcı tablosu yok; panele sadece tek kişi (gece resepsiyonisti) giriyor.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'cf_admin';
const TTL_SECONDS = 12 * 60 * 60; // bir vardiya + pay
const MIN_PASSWORD_LENGTH = 12;

/**
 * İmza anahtarı şifreden türetilir: şifre değiştirilince açık oturumların
 * hepsi kendiliğinden geçersiz olur, ayrıca bir secret yönetmek gerekmez.
 */
function signingKey() {
  return createHash('sha256').update(`cf-session:${process.env.ADMIN_PASSWORD}`).digest();
}

function sign(payload) {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

// Uzunluğu farklı girdilerde timingSafeEqual hata attığı için önce özetleri karşılaştırılır.
function safeEqual(a, b) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Zayıf ya da tanımsız şifreyle panelin hiç açılmaması için ön koşul. */
export function isConfigured() {
  return typeof process.env.ADMIN_PASSWORD === 'string' && process.env.ADMIN_PASSWORD.length >= MIN_PASSWORD_LENGTH;
}

export function checkPassword(input) {
  return isConfigured() && safeEqual(String(input ?? ''), process.env.ADMIN_PASSWORD);
}

export function sessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const value = `${exp}.${sign(String(exp))}`;
  // Path=/api/admin: çerez misafir sayfasının isteklerine hiç eklenmez.
  return `${COOKIE}=${value}; Path=/api/admin; Max-Age=${TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function hasValidSession(req) {
  if (!isConfigured()) return false;
  const match = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!match) return false;
  const [exp, sig] = match[1].split('.');
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now() / 1000;
}

/**
 * CSRF koruması: SameSite=Strict'e ek olarak, durum değiştiren isteklerde
 * Origin başlığının sitenin kendi adresi olması şart koşulur.
 */
export function isSameOrigin(req) {
  const origin = req.headers.origin;
  return Boolean(origin) && new URL(origin).host === req.headers.host;
}

/*
 * Kaba kuvvet denemelerini yavaşlatmak için IP başına sayaç.
 * Sınırlama: sayaç fonksiyon örneğinin belleğinde tutulur; Vercel birden çok
 * örnek açarsa her biri ayrı sayar. Asıl koruma uzun şifre (en az 12 karakter).
 */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function clientIp(req) {
  // Vercel x-forwarded-for'u kendisi yazar; ilk öğe istemcinin gerçek adresi.
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

export function isRateLimited(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first > WINDOW_MS) return false;
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailure(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first > WINDOW_MS) attempts.set(ip, { first: now, count: 1 });
  else entry.count += 1;
}
