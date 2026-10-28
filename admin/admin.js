/*
 * Panel davranışı: oturum kontrolü, giriş/çıkış, mevcut ayarın forma
 * doldurulması ve kaydetme. Asıl doğrulama sunucuda (api/_lib/site.js);
 * buradaki kontroller sadece hızlı geri bildirim için.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const loginForm = $('login');
  const settingsForm = $('settings');
  // Form bir kez doldurulduysa yeniden girişte üzerine yazılmaz (oturum süresi
  // dolup tekrar giriş yapıldığında kaydedilmemiş değişiklikler korunur).
  let filled = false;

  const FIELD_LABELS = {
    phone: 'Numara geçersiz (+90 5XX XXX XX XX biçiminde olmalı).',
    shift: 'Vardiya saatleri geçersiz.',
    status: 'Durum seçilmeli.'
  };

  function show(form) {
    loginForm.hidden = form !== loginForm;
    settingsForm.hidden = form !== settingsForm;
  }

  function message(el, text, kind) {
    el.textContent = text;
    el.dataset.kind = kind || '';
  }

  async function api(path, options = {}) {
    return fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
  }

  /**
   * Formu doldurur. Canlı ayar yoksa (henüz hiç kaydedilmemiş ya da API
   * cevap vermiyor) js/config.js'teki yedek değerler kullanılır.
   */
  async function fillForm() {
    let site = { ...window.CF_CONFIG };
    try {
      // cache: 'no-store' tarayıcı önbelleğini atlar; CDN tarafında en fazla ~10 sn eski olabilir.
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (res.ok) {
        const live = await res.json();
        if (live && live.phone) site = { ...site, ...live };
      }
    } catch { /* yedek değerlerle devam */ }

    $('phone').value = site.phone;
    $('start').value = site.shift.start;
    $('end').value = site.shift.end;
    settingsForm.querySelector(`input[name="status"][value="${site.status === 'off' ? 'off' : 'auto'}"]`).checked = true;
    for (const lang of ['tr', 'en', 'ru']) $(`ann-${lang}`).value = site.announcement?.[lang] || '';
    showUpdated(site.updatedAt);
    filled = true;
  }

  function showUpdated(iso) {
    $('updated').textContent = iso
      ? `Son kayıt: ${new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`
      : '';
  }

  async function init() {
    try {
      const res = await api('/api/admin/session');
      const { authenticated, configured } = await res.json();
      if (!configured) {
        show(loginForm);
        message($('login-msg'), 'Panel henüz yapılandırılmamış (ADMIN_PASSWORD tanımlı değil).', 'error');
        return;
      }
      if (authenticated) {
        await fillForm();
        show(settingsForm);
      } else {
        show(loginForm);
        $('password').focus();
      }
    } catch {
      show(loginForm);
      message($('login-msg'), 'Sunucuya ulaşılamadı.', 'error');
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('login-msg');
    message(msg, '');
    const res = await api('/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ password: $('password').value })
    });
    $('password').value = '';
    if (res.ok) {
      if (!filled) await fillForm();
      show(settingsForm);
    } else if (res.status === 429) {
      message(msg, 'Çok fazla deneme. 15 dakika sonra tekrar dene.', 'error');
    } else {
      message(msg, 'Şifre yanlış.', 'error');
    }
  });

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('save-msg');
    const btn = $('save');
    $('phone').removeAttribute('aria-invalid');

    const body = {
      phone: $('phone').value,
      shift: { start: $('start').value, end: $('end').value },
      status: settingsForm.querySelector('input[name="status"]:checked')?.value,
      announcement: { tr: $('ann-tr').value, en: $('ann-en').value, ru: $('ann-ru').value }
    };

    btn.disabled = true;
    message(msg, 'Kaydediliyor…');
    try {
      const res = await api('/api/admin/config', { method: 'PUT', body: JSON.stringify(body) });
      if (res.ok) {
        const saved = await res.json();
        message(msg, 'Kaydedildi. Sitede birkaç saniye içinde görünür.', 'ok');
        showUpdated(saved.updatedAt);
      } else if (res.status === 401) {
        // Oturum süresi doldu; kaydedilmemiş değişiklik kaybolmasın diye form temizlenmez.
        show(loginForm);
        message($('login-msg'), 'Oturum süresi doldu, tekrar giriş yap. Değişikliklerin formda duruyor.', 'error');
      } else if (res.status === 400) {
        const { fields = [] } = await res.json();
        if (fields.includes('phone')) $('phone').setAttribute('aria-invalid', 'true');
        message(msg, fields.map((f) => FIELD_LABELS[f] || 'Duyuru en fazla 200 karakter olabilir.').join(' '), 'error');
      } else {
        message(msg, 'Kaydedilemedi. Biraz sonra tekrar dene.', 'error');
      }
    } catch {
      message(msg, 'Sunucuya ulaşılamadı.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  $('logout').addEventListener('click', async () => {
    await api('/api/admin/session', { method: 'DELETE' });
    show(loginForm);
    message($('login-msg'), 'Çıkış yapıldı.');
  });

  init();
})();
