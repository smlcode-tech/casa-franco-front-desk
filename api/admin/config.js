/*
 * PUT /api/admin/config — panelden gelen ayarı doğrulayıp Edge Config'e yazar.
 * Misafir sayfasını değiştiren tek yazma yolu budur; oturum + Origin kontrolü
 * olmadan hiçbir şey yazılmaz.
 */
import { hasValidSession, isSameOrigin } from '../_lib/session.js';
import { MissingEnvError, validateSite, writeSite } from '../_lib/site.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).end();
  }
  if (!isSameOrigin(req)) return res.status(403).json({ error: 'origin' });
  if (!hasValidSession(req)) return res.status(401).json({ error: 'unauthenticated' });

  const { value, errors } = validateSite(req.body);
  if (errors) return res.status(400).json({ error: 'invalid', fields: errors });

  try {
    await writeSite(value);
    return res.status(200).json(value);
  } catch (err) {
    console.error(err);
    // Değişken adı sadece oturum açmış panel kullanıcısına döner; değeri asla dönmez.
    if (err instanceof MissingEnvError) {
      return res.status(500).json({ error: 'missing_env', name: err.envName });
    }
    return res.status(502).json({ error: 'write_failed' });
  }
}
