export interface ReligiousDayEntry {
  name: string;
  /** YYYY-MM-DD, Gregorian calendar day as published by Diyanet — not computed from hijri arithmetic. */
  date: string;
}

/**
 * Design-refresh-v3 Faz 19 Ekleme 5. Hicri-çevirici kütüphaneler Diyanet'in
 * resmi takviminden bir gün sapabilir (bkz. hijri.ts'teki not) — bu yüzden
 * bu tarihler ASLA hesaplanmaz, doğrudan Diyanet'in kendi resmi
 * yayınından elle girilmiştir. Kaynak (kullanıcı onayıyla, 2026-08-05'te
 * doğrudan alınmıştır):
 *
 *   T.C. Diyanet İşleri Başkanlığı — Vakit Hesaplama, Dini Gün ve Geceler
 *   İndeks: https://vakithesaplama.diyanet.gov.tr/dini_gunler.php
 *   2026: https://vakithesaplama.diyanet.gov.tr/dinigunler.php?yil=2026
 *   2027: https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154
 *
 * Veri tükendiğinde (bu listenin son tarihinden sonrası) arayüz sessizce
 * boş göstermek yerine "takvim güncellenecek" durumunu göstermelidir —
 * bkz. religiousDaysSchedule.ts.
 */
export const RELIGIOUS_DAYS: ReligiousDayEntry[] = [
  { name: 'Miraç Kandili', date: '2026-01-15' },
  { name: 'Berat Kandili', date: '2026-02-02' },
  { name: 'Ramazan Başlangıcı', date: '2026-02-19' },
  { name: 'Kadir Gecesi', date: '2026-03-16' },
  { name: 'Ramazan Bayramı Arefesi', date: '2026-03-19' },
  { name: 'Ramazan Bayramı (1. Gün)', date: '2026-03-20' },
  { name: 'Kurban Bayramı Arefesi', date: '2026-05-26' },
  { name: 'Kurban Bayramı (1. Gün)', date: '2026-05-27' },
  { name: 'Mevlid Kandili', date: '2026-08-24' },
  { name: 'Üç Ayların Başlangıcı', date: '2026-12-10' },
  { name: 'Regaib Kandili', date: '2026-12-10' },
  { name: 'Miraç Kandili', date: '2027-01-04' },
  { name: 'Berat Kandili', date: '2027-01-22' },
  { name: 'Ramazan Başlangıcı', date: '2027-02-08' },
  { name: 'Kadir Gecesi', date: '2027-03-05' },
  { name: 'Ramazan Bayramı Arefesi', date: '2027-03-08' },
  { name: 'Ramazan Bayramı (1. Gün)', date: '2027-03-09' },
  { name: 'Kurban Bayramı Arefesi', date: '2027-05-15' },
  { name: 'Kurban Bayramı (1. Gün)', date: '2027-05-16' },
  { name: 'Mevlid Kandili', date: '2027-08-13' },
  { name: 'Üç Ayların Başlangıcı', date: '2027-11-29' },
  { name: 'Regaib Kandili', date: '2027-12-02' },
  { name: 'Miraç Kandili', date: '2027-12-24' },
];
