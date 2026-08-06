export interface EzanAttribution {
  workTitle: string;
  uploader: string;
  sourceUrl: string;
  licenseUrl: string;
  modificationStatement: string;
}

/**
 * CC BY-SA 4.0's attribution requirement has five parts: work title,
 * uploader/author, source link, license link, and a modification
 * statement (design-refresh-v3 Faz 21 madde 3).
 *
 * The modification statement below is not a guess: public/sounds/ezan.mp3's
 * SHA1 (971bced4b0bf6067358afc78cac6e9d219226c19) was computed locally and
 * compared against the SHA1 Wikimedia Commons' own API reports for this
 * exact file (action=query&prop=imageinfo&iiprop=sha1, checked 2026-08-06)
 * — they match exactly, so the file shipped here is byte-identical to the
 * Commons original, not a derivative. licenses.test.ts re-verifies this
 * hash against the actual shipped file on every test run.
 */
export const EZAN_ATTRIBUTION: EzanAttribution = {
  workTitle: 'The Adhan - Muslim Call to Prayer - Aaqib Azeez',
  uploader: 'Atcovi',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  modificationStatement:
    'Değiştirilmedi — dosya, Wikimedia Commons\'taki orijinaliyle bit-bit aynıdır (doğrulama: yerel SHA1 971bced4b0bf6067358afc78cac6e9d219226c19, Commons API\'nin bu dosya için bildirdiği sha1 ile birebir eşleşiyor).',
};
