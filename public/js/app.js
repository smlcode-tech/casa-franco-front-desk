/*
 * İletişim sayfasının (index.html) davranışı: dil seçimi, metinlerin
 * yerleştirilmesi, WhatsApp/rehber butonları ve "görevde" göstergesi.
 * Veri önce config.js'teki yedek değerlerden, ardından panelden kaydedilen
 * canlı ayardan (/api/config) gelir; metinler i18n.js'ten, hesaplar contact.js'ten.
 */
(function () {
  const cfg = window.CF_CONFIG;
  const strings = window.CF_I18N;
  const LANGS = Object.keys(strings);
  const STORAGE_KEY = 'cf-lang';

  // localStorage gizli sekmede ya da engelli çerezde hata fırlatabilir;
  // tercih hatırlanmasa da sayfa çalışmaya devam etmeli.
  function readStoredLang() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }
  function storeLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* yok say */ }
  }

  /** Önce misafirin daha önceki seçimi, sonra telefonun dili, en son İngilizce. */
  function detectLang() {
    const stored = readStoredLang();
    if (LANGS.includes(stored)) return stored;
    for (const l of navigator.languages || [navigator.language]) {
      const code = (l || '').slice(0, 2).toLowerCase();
      if (LANGS.includes(code)) return code;
    }
    // Varsayılan İngilizce: misafirin dili bilinmiyorsa en geniş ortak dil.
    return 'en';
  }

  function render(lang) {
    const t = strings[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t[el.dataset.i18n];
    });
    document.querySelectorAll('.lang button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });

    document.getElementById('wa').href = CF.whatsappUrl(t.prefill);
    document.getElementById('phone').textContent = CF.formatPhone();
    document.getElementById('shift-hours').textContent = `${cfg.shift.start} – ${cfg.shift.end}`;
    const em = document.getElementById('emergency-link');
    em.href = `tel:${cfg.emergency}`;
    em.textContent = cfg.emergency;

    // Panelden "bu gece görevde değilim" seçildiyse saat hesabı devre dışı kalır.
    const away = cfg.status === 'off';
    const onDuty = !away && CF.isOnDuty();
    const status = document.getElementById('status');
    status.dataset.state = onDuty ? 'on' : 'off';
    status.querySelector('span').textContent = away ? t.away : onDuty ? t.onDuty : t.offDuty;

    // Duyuru düz metin olarak basılır (textContent); panelden HTML enjekte edilemez.
    const note = document.getElementById('announcement');
    const text = cfg.announcement?.[lang] || '';
    note.textContent = text;
    note.hidden = !text;

    document.body.classList.toggle('phone-incomplete', !CF.isPhoneComplete());
  }

  /**
   * Panelden kaydedilen canlı ayarı çeker ve yedek değerlerin üzerine yazar.
   * Ağ hatası, zaman aşımı ya da 503'te sessizce yedek değerlerle devam edilir:
   * misafir sayfası API'ye bağımlı olup boş kalmamalı.
   */
  async function loadLive() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    try {
      const res = await fetch('/api/config', { signal: ctrl.signal });
      if (!res.ok) return;
      const live = await res.json();
      if (live && live.phone) Object.assign(cfg, live);
      render(lang);
    } catch { /* yedek değerlerle devam */ } finally {
      clearTimeout(timer);
    }
  }

  /** Rehber kartını indirir; dil seçimine göre kişi adı değişir. */
  function downloadVcard(lang) {
    const blob = new Blob([CF.vcard(strings[lang].contactName)], { type: 'text/vcard' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'casa-franco-night-reception.vcf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  let lang = detectLang();
  render(lang);

  document.querySelectorAll('.lang button').forEach((b) => {
    b.addEventListener('click', () => {
      lang = b.dataset.lang;
      storeLang(lang);
      render(lang);
    });
  });
  document.getElementById('save').addEventListener('click', () => downloadVcard(lang));

  loadLive();

  // Sayfa uzun süre açık kalırsa vardiya durumu bayatlamasın.
  setInterval(() => render(lang), 60 * 1000);
})();
