/*
 * Casa Franco gece resepsiyonu — tek ayar dosyası.
 *
 * Sayfadaki (index.html), rehber kartındaki (vCard) ve masa kartındaki
 * (print/desk-card.html) bütün iletişim verisi buradan okunur. Numara ya da
 * saat değişince sadece bu dosya güncellenir; aynı bilginin iki yerde
 * tutulup birbirinden kopması böylece engellenir.
 */
window.CF_CONFIG = {
  // E.164 biçiminde tam numara. Türkiye cep numarası +90 ile birlikte 12 hanedir.
  phone: '+905016706820',

  // Vardiya, otelin saat diliminde (HH:MM). Bitiş başlangıçtan küçükse
  // vardiya gece yarısını aşıyor demektir.
  shift: { start: '22:00', end: '08:00' },

  // "Şu an görevde" göstergesi misafirin telefonunun değil, otelin saatine
  // göre hesaplanmalı; yabancı misafirlerin telefonu kendi ülke saatinde olabilir.
  timeZone: 'Europe/Istanbul',

  // Masa kartındaki QR'ın hedefi. Boşsa QR doğrudan WhatsApp'a gider.
  // Sayfa yayınlanınca buraya kalıcı URL yazılmalı; böylece numara değişse de
  // basılı kartları yenilemek gerekmez.
  siteUrl: 'https://casa-franco-front-desk.vercel.app/',

  // Acil durum numarası (Türkiye, tek acil çağrı hattı).
  emergency: '112'
};
