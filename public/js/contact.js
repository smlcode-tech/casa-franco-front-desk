/*
 * İletişim yardımcıları — window.CF_CONFIG'teki ham veriyi kullanılabilir
 * biçime çevirir. Hem iletişim sayfası (app.js) hem masa kartı
 * (print/desk-card.html) aynı hesapları kullandığı için ortak dosyada durur.
 * Ayar her çağrıda yeniden okunur: app.js panelden gelen canlı ayarı
 * sayfa yüklendikten sonra CF_CONFIG'e uyguluyor.
 */
window.CF = (function () {
  const cfg = () => window.CF_CONFIG;
  const phoneDigits = () => cfg().phone.replace(/\D/g, '');

  /** Eksik numarayla yayın/baskı yapılmasını engellemek için kontrol. */
  function isPhoneComplete() {
    const digits = phoneDigits();
    // Türkiye: 90 + 10 hane. Başka ülke kodu gelirse E.164 üst sınırı (15) geçerli.
    return digits.startsWith('90') ? digits.length === 12 : digits.length >= 8 && digits.length <= 15;
  }

  /** Misafirin okuyabileceği biçim: +90 5XX XXX XX XX. */
  function formatPhone() {
    const digits = phoneDigits();
    if (digits.startsWith('90') && digits.length === 12) {
      const d = digits.slice(2);
      return `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
    }
    return cfg().phone;
  }

  /**
   * WhatsApp sohbet bağlantısı. Hazır mesaj, misafirin oda numarasını ilk
   * mesajda yazmasını sağlar; gece gelen mesajlarda "hangi oda?" sorusuyla
   * vakit kaybını önler.
   */
  function whatsappUrl(prefill) {
    const base = `https://wa.me/${phoneDigits()}`;
    return prefill ? `${base}?text=${encodeURIComponent(prefill)}` : base;
  }

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /** Otelin saat dilimindeki şu anki dakikaya göre vardiyada olup olmadığı. */
  function isOnDuty(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: cfg().timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now);
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    const current = get('hour') * 60 + get('minute');
    const start = toMinutes(cfg().shift.start);
    const end = toMinutes(cfg().shift.end);
    // Gece yarısını aşan vardiyada (22:00–08:00) aralık iki parçaya bölünür.
    return start <= end ? current >= start && current < end : current >= start || current < end;
  }

  /**
   * vCard 3.0 metni. Dosya olarak depoda tutulmaz, config'ten üretilir;
   * böylece numara değişince eski bir .vcf dosyası unutulup kalmaz.
   */
  function vcard(contactName) {
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contactName}`,
      'ORG:Casa Franco',
      `TEL;TYPE=CELL:+${phoneDigits()}`,
      'END:VCARD'
    ].join('\r\n'); // vCard standardı satır sonu olarak CRLF ister.
  }

  return { isPhoneComplete, formatPhone, whatsappUrl, isOnDuty, vcard };
})();
