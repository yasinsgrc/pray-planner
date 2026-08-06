import { KERAHET_KNOWLEDGE } from './knowledge';

export interface AboutUserSection {
  title: string;
  /** null = kullanıcı henüz doldurmadı — arayüz bunu privacy.ts'teki
   * doldurulmamış env-var uyarısıyla aynı ilkeyle gözden kaçırılmaz bir
   * kırmızı uyarı olarak gösterir; içerik burada ÜRETİLMEZ. */
  body: string | null;
}

/**
 * Design-refresh-v3 Faz 20 madde 4 — bu bölümlerin metnini kullanıcı
 * kendisi dolduracak ("İÇERİĞİ SEN YAZMA"). Yapı burada, içerik boş.
 */
export const ABOUT_USER_SECTIONS: AboutUserSection[] = [
  { title: 'VAKİT Nedir?', body: null },
  { title: 'İletişim', body: null },
];

export interface AboutFact {
  title: string;
  body: string;
}

export interface LibraryLicense {
  name: string;
  license: string;
}

/**
 * Aşağıdaki gerçekler kodda doğrulanabilir olduğu için burada dolduruldu
 * (kullanıcının "ama şu teknik kısımları sen doldur" isteği) — hiçbiri
 * yeni dini içerik değil, sadece kaynak/lisans/yöntem bilgisi.
 */
export const ABOUT_VERIFIED_FACTS: AboutFact[] = [
  {
    title: 'Vakitler Nasıl Hesaplanıyor?',
    body:
      "Namaz vakitleri, adhan kütüphanesi (MIT lisanslı, npm) ile Türkiye Diyanet İşleri Başkanlığı hesaplama yöntemi kullanılarak cihazda hesaplanır. Ölçüme göre bu yöntem Diyanet'in yayınladığı vakitlerden en fazla 1 dakika sapabilir (yuvarlama farkı); vakitler internet olmadan da hesaplanabilir.",
  },
  {
    title: 'Kerahet Vakitleri Bilgisinin Kaynağı',
    body: `${KERAHET_KNOWLEDGE.sourceCitation}. ${KERAHET_KNOWLEDGE.sourcedFrom}`,
  },
  {
    title: 'Dini Günler ve Kandil Tarihlerinin Kaynağı',
    body:
      'Tarihler hesaplanmamış, T.C. Diyanet İşleri Başkanlığı — Vakit Hesaplama, "Dini Gün ve Geceler" sayfasından elle girilmiştir: vakithesaplama.diyanet.gov.tr/dini_gunler.php (2026: vakithesaplama.diyanet.gov.tr/dinigunler.php?yil=2026, 2027: vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154).',
  },
  {
    title: 'Günün Ayeti Kaynağı',
    body: 'Günlük Kur\'an meali, ummahapi.com servisinden Türkçe çeviri olarak canlı alınır; servise erişilemediğinde uygulama içindeki sabit bir ayet/hadis/dua havuzuna düşer.',
  },
  {
    title: 'Ezan Sesi Lisansı',
    body:
      'Kaynak: Wikimedia Commons, dosya "The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3", yükleyen: Atcovi. Lisans: CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0/). Dosya değiştirilmeden kullanılmaktadır. commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3',
  },
];

/** Yalnızca istemci paketine gerçekten giren, çalışan çalışma-zamanı kütüphaneleri — derleme/geliştirme araçları (Vite, TypeScript, Tailwind vb.) hariç. */
export const ABOUT_LIBRARY_LICENSES: LibraryLicense[] = [
  { name: 'React', license: 'MIT' },
  { name: 'React DOM', license: 'MIT' },
  { name: 'adhan', license: 'MIT' },
  { name: 'hijri-converter', license: 'MIT' },
  { name: 'motion', license: 'MIT' },
  { name: '@phosphor-icons/react', license: 'MIT' },
];
