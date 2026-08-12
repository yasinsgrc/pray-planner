export interface Dua {
  readonly arabic: string;
  readonly transliteration: string;
  readonly meaning: string;
  readonly source: string;
}

/**
 * Ana ekrandaki sabit dua kartının içeriği (Faz 25 Commit 2 — imsak
 * ilerleme çubuğunun yerine geçti). Dizi olarak tanımlı: tek kayıt olsa
 * bile, ileride küçük bir dua seti eklenmek istenirse yapı değişmesin diye.
 *
 * Ümmü Seleme radıyallahu anhâ'dan: Hz. Peygamber'in yanındayken en çok
 * okuduğu dua. Diyanet'in Riyâzü's-Sâlihîn tercümesinden doğrulanarak
 * girildi (Tirmizî, Kader 7, Daavât 90, 124; ayrıca bk. Ahmed İbni Hanbel,
 * Müsned, IV, 182, VI, 91, 251, 294, 302, 315).
 */
export const DUALAR: readonly Dua[] = [
  {
    arabic: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِى عَلٰى دِينِكَ',
    transliteration: "Yâ mukallibe'l-kulûb! Sebbit kalbî alâ dînik",
    meaning: 'Ey kalpleri halden hale çeviren Allah! Benim kalbimi dininden ayırma!',
    source: 'Tirmizî, Kader 7, Daavât 90, 124. Ayrıca bk. Ahmed İbni Hanbel, Müsned, IV, 182, VI, 91, 251, 294, 302, 315',
  },
];
