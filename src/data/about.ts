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
 * kendisi doldurdu (design-refresh-v3 Faz 24 Commit 1).
 */
export const ABOUT_USER_SECTIONS: AboutUserSection[] = [
  {
    title: 'VAKİT Nedir?',
    body: "VAKİT, namaz vakitlerini cihazınızda hesaplayan bir uygulamadır. Vakitler Diyanet İşleri Başkanlığı'nın hesaplama yöntemiyle, internet bağlantısı olmadan da hesaplanabilir. Uygulama reklam içermez, hesap açmanızı istemez ve konum koordinatlarınızı sunucuya göndermez. Kullanılan açık kaynak kütüphanelerin lisansları \"Lisanslar\" ekranında listelenmiştir.",
  },
  {
    title: 'İletişim',
    body: 'Uygulamayla ilgili sorularınız, hata bildirimleriniz ve gizlilikle ilgili talepleriniz için: yyasinsgrc@gmail.com\n\nAyarlar ekranındaki "Geri Bildirim" bağlantısı da aynı adrese yazmanızı sağlar.',
  },
];

export interface AboutFact {
  title: string;
  body: string;
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
    body: 'Wikimedia Commons, CC BY-SA 4.0 (Atcovi). Tam atıf (eser adı, kaynak, lisans, değişiklik beyanı) ve kullanılan açık kaynak kütüphanelerin tam lisans metni "Lisanslar" ekranında.',
  },
];
