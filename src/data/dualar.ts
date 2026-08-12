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
 * Bu alanlar placeholder'dır — gerçek Arapça metin, okunuş, meal ve kaynak
 * künyesi Diyanet'in basılı Riyâzü's-Sâlihîn tercümesinden elle
 * doğrulanarak girilecek (rivayet Ümmü Seleme'den; Tirmizî, Kader 7 ve
 * Daavât 90/124; ayrıca Ahmed b. Hanbel, Müsned). Yapı ve testler bu
 * placeholder'larla yeşile alınır, içerik doğruluğu test edilmez.
 */
export const DUALAR: readonly Dua[] = [
  {
    arabic: '<<ARAPÇA METİN — Diyanet Riyâzü\'s-Sâlihîn\'den birebir, harekeli>>',
    transliteration: '<<OKUNUŞ — Diyanet tercümesindeki latinize hali>>',
    meaning: '<<MEAL — Diyanet tercümesinden birebir>>',
    source: '<<KAYNAK KÜNYESİ>>',
  },
];
