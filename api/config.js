/*
 * GET /api/config — misafir sayfasının okuduğu canlı ayar (herkese açık).
 * Panelden kaydedilen değerleri döner; sayfa bunları js/config.js'teki
 * yedek değerlerin üzerine uygular.
 */
import { readSite } from './_lib/site.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  try {
    const site = await readSite();
    // Kısa CDN önbelleği: panelden yapılan değişiklik en geç ~10 sn'de görünür,
    // ama her misafir isteği Edge Config'e gitmez.
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');
    return res.status(200).json(site ?? {});
  } catch (err) {
    console.error(err);
    // Sayfa bu durumda yedek değerlerle çalışmaya devam eder.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'unavailable' });
  }
}
