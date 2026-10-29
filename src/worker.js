/*
 * Cloudflare Worker giriş noktası. Her isteği karşılar:
 *   - /api/config            → canlı ayar (herkese açık, salt okuma)
 *   - /api/admin/session     → panel girişi/çıkışı
 *   - /api/admin/config      → panelden ayar yazma
 *   - diğer her şey          → public/ altındaki statik dosyalar (ASSETS binding)
 * Vercel'deki api/*.js fonksiyonlarının ve vercel.json başlıklarının karşılığı.
 */
import { MissingEnvError, readSite, validateSite, writeSite } from './site.js';
import {
  checkPassword, clearCookie, hasValidSession, isConfigured,
  isRateLimited, isSameOrigin, recordFailure, sessionCookie
} from './session.js';

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', ...headers }
  });
}

const NO_STORE = { 'Cache-Control': 'no-store' };

/** GET /api/config — misafir sayfası ve panel bunu okur. */
async function getConfig(env) {
  try {
    const site = await readSite(env);
    // Kısa tarayıcı önbelleği; KV zaten kendi tarafında önbellekliyor.
    return json(site ?? {}, 200, { 'Cache-Control': 'public, max-age=10' });
  } catch (err) {
    console.error(err);
    // Sayfa bu durumda js/config.js'teki yedek değerlerle çalışmaya devam eder.
    return json({ error: 'unavailable' }, 503, NO_STORE);
  }
}

async function session(request, env) {
  if (request.method === 'GET') {
    return json({ authenticated: await hasValidSession(env, request), configured: isConfigured(env) }, 200, NO_STORE);
  }
  if (!isSameOrigin(request)) return json({ error: 'origin' }, 403, NO_STORE);

  if (request.method === 'POST') {
    if (!isConfigured(env)) return json({ error: 'not_configured' }, 503, NO_STORE);
    if (isRateLimited(request)) return json({ error: 'rate_limited' }, 429, NO_STORE);
    const body = await request.json().catch(() => ({}));
    if (!(await checkPassword(env, body?.password))) {
      recordFailure(request);
      return json({ error: 'invalid' }, 401, NO_STORE);
    }
    return json({ authenticated: true }, 200, { ...NO_STORE, 'Set-Cookie': await sessionCookie(env) });
  }

  if (request.method === 'DELETE') {
    return new Response(null, { status: 204, headers: { ...NO_STORE, 'Set-Cookie': clearCookie() } });
  }
  return json({ error: 'method' }, 405, { ...NO_STORE, Allow: 'GET, POST, DELETE' });
}

/**
 * PUT /api/admin/config — misafir sayfasını değiştiren tek yazma yolu.
 * Sıra önemli: önce Origin, sonra oturum, sonra girdi doğrulaması.
 */
async function putConfig(request, env) {
  if (request.method !== 'PUT') return json({ error: 'method' }, 405, { ...NO_STORE, Allow: 'PUT' });
  if (!isSameOrigin(request)) return json({ error: 'origin' }, 403, NO_STORE);
  if (!(await hasValidSession(env, request))) return json({ error: 'unauthenticated' }, 401, NO_STORE);

  const body = await request.json().catch(() => null);
  const { value, errors } = validateSite(body);
  if (errors) return json({ error: 'invalid', fields: errors }, 400, NO_STORE);

  try {
    await writeSite(env, value);
    return json(value, 200, NO_STORE);
  } catch (err) {
    console.error(err);
    // Ayar adı sadece oturum açmış panel kullanıcısına döner; değeri asla dönmez.
    if (err instanceof MissingEnvError) return json({ error: 'missing_env', name: err.envName }, 500, NO_STORE);
    return json({ error: 'write_failed' }, 502, NO_STORE);
  }
}

/** Panel sayfaları için vercel.json'daki güvenlik başlıklarının karşılığı. */
async function serveAsset(request, env) {
  const res = await env.ASSETS.fetch(request);
  if (!new URL(request.url).pathname.startsWith('/admin')) return res;
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/config') {
      return request.method === 'GET' ? getConfig(env) : json({ error: 'method' }, 405, { Allow: 'GET' });
    }
    if (pathname === '/api/admin/session') return session(request, env);
    if (pathname === '/api/admin/config') return putConfig(request, env);
    if (pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    return serveAsset(request, env);
  }
};
