/*
 * İletişim sayfasının (index.html) davranışı: dil seçimi, metinlerin
 * yerleştirilmesi, WhatsApp/rehber butonları ve "görevde" göstergesi.
 * Veri config.js'ten, metinler i18n.js'ten, hesaplar contact.js'ten gelir.
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

    const onDuty = CF.isOnDuty();
    const status = document.getElementById('status');
    status.dataset.state = onDuty ? 'on' : 'off';
    status.querySelector('span').textContent = onDuty ? t.onDuty : t.offDuty;
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

  // Sayfa uzun süre açık kalırsa vardiya durumu bayatlamasın.
  setInterval(() => render(lang), 60 * 1000);

  if (!CF.isPhoneComplete()) {
    console.warn('CF: config.js içindeki telefon numarası eksik — yayınlamadan önce tamamlayın.');
    document.body.classList.add('phone-incomplete');
  }
})();
