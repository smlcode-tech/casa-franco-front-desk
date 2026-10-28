/*
 * /api/admin/session — panel oturumu.
 *   GET    → oturum açık mı (panel açılışında)
 *   POST   → { password } ile giriş
 *   DELETE → çıkış
 */
import {
  checkPassword, clearCookie, hasValidSession, isConfigured,
  isRateLimited, isSameOrigin, recordFailure, sessionCookie
} from '../_lib/session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({ authenticated: hasValidSession(req), configured: isConfigured() });
  }

  if (!isSameOrigin(req)) return res.status(403).json({ error: 'origin' });

  if (req.method === 'POST') {
    if (!isConfigured()) return res.status(503).json({ error: 'not_configured' });
    if (isRateLimited(req)) return res.status(429).json({ error: 'rate_limited' });
    if (!checkPassword(req.body?.password)) {
      recordFailure(req);
      return res.status(401).json({ error: 'invalid' });
    }
    res.setHeader('Set-Cookie', sessionCookie());
    return res.status(200).json({ authenticated: true });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearCookie());
    return res.status(204).end();
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).end();
}
