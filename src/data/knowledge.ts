/**
 * Structured reference/knowledge-card content (design-refresh-v3 Faz 7 F2)
 * — for topics that need a citation and a fıkhî-caution note, not just a
 * line of UI copy (those belong in strings.ts). Every entry's religious
 * text (hadith wording, source citation) must be sourced from a published
 * translation, never written from memory — see each entry's `sourcedFrom`
 * for where it was verified.
 */
export interface KnowledgeSection {
  heading?: string;
  body: string;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  sections: KnowledgeSection[];
  sourceCitation: string;
  warningNote: string;
  /** Where the religious text in this entry was verified against, for future auditing. */
  sourcedFrom: string;
}

export const KERAHET_KNOWLEDGE: KnowledgeEntry = {
  id: 'kerahet-vakitleri',
  title: 'Kerahet Vakitleri Nedir?',
  sections: [
    {
      heading: 'Kelime Anlamı',
      body:
        '"Kerahet", Arapça kökenli bir kelime olup iğrenme, hoş görmeme anlamına gelir. Fıkıh terimi olarak namaz kılmanın mekruh (hoş karşılanmayan) olduğu vakitleri ifade eder. Halk arasında "kerahat" olarak da söylenir; TDK\'ye göre doğru yazım "kerahet"tir.',
    },
    {
      heading: 'Üç Kerahet Vakti',
      body:
        'İşrâk (güneşin doğuşu), İstivâ/Zevâl (güneşin tam tepe noktasında oluşu) ve Gurûb (güneşin batışı) olmak üzere üç vakitte namaz kılmak mekruhtur. Bu vakitler güneşin gökyüzündeki konumuyla belirlenir; her biri yaklaşık kırk beş dakika sürer.',
    },
    {
      heading: 'Hadis',
      body:
        'Ukbe b. Âmir el-Cühenî\'den rivayet edilmiştir: "Resûlullah (s.a.s.) bize üç vakitte namaz kılmayı (veya ölülerimizi defnetmeyi) yasakladı: Güneşin doğmasından itibaren (bir veya iki mızrak boyu) yükselmesine kadar, güneşin gökyüzünde tam dik oluşundan (batıya) yönelmesine kadar ve güneşin sararmasından itibaren batmasına kadar."',
    },
    {
      heading: 'Mezhep Farkı',
      body:
        'Hanefî ve Şâfiî mezhepleri bu vakitlerde kaza namazı kılınıp kılınamayacağında ayrışır; Cuma günü istivâ vakti için ayrı görüşler vardır.',
    },
  ],
  sourceCitation: 'Müslim, Müsâfirîn 293; Ebû Dâvûd, Cenâiz 55; Tirmizî, Cenâiz 41',
  warningNote: "Fıkhî ayrıntılar için Diyanet İşleri Başkanlığı'na veya müftülüğünüze danışınız.",
  sourcedFrom:
    'Diyanet İşleri Başkanlığı Din İşleri Yüksek Kurulu, "Kerâhat vakitlerinde namaz kılmanın yasak olmasının sebebi ve hikmeti nedir?" — kurul.diyanet.gov.tr/tr/fetva/kerahat-vakitlerinde-namaz-kilmanin-yasak-olmasinin-sebebi/0193c42d-4dce-77f7-0d1e-f544335f96cb (Ağustos 2026 itibarıyla erişildi ve ikinci bağımsız kaynakla doğrulandı).',
};
