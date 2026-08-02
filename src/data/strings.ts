import { PrayerName, KerahetInfo } from '../types';

/**
 * Central home for the Turkish terms that have actually caused bugs twice
 * (design-refresh-v3 Faz 1 "Akşam'ye", Faz 5 "20:26'de başlıyor") — prayer
 * names, their dative forms, and kerahet vocabulary, all previously
 * duplicated across prayerCalculator.ts, kerahetLabels.ts, and
 * SpiritualSettings.tsx with no single place to proofread them together.
 * Every entry here was re-read once end-to-end for: dative-suffix
 * agreement, İ/I casing, diacritic consistency (â/î), and matching
 * terminology across every occurrence of the same word.
 *
 * Scope note: this covers the terminology-critical strings that drift
 * causes real bugs (names, suffixed forms, kerahet terms) — not literally
 * every UI string in the app (button labels, one-off disclaimers, etc.),
 * which still live next to the component that renders them.
 */

export const PRAYER_LABELS: Record<PrayerName, string> = {
  imsak: 'İmsak',
  gunes: 'Güneş',
  ogle: 'Öğle',
  ikindi: 'İkindi',
  aksam: 'Akşam',
  yatsi: 'Yatsı',
};

// Turkish vowel harmony means a single fixed suffix ('-ye/-ya) is wrong for
// some prayer names (e.g. "Akşam'ye" should be "Akşam'a") — a fixed lookup
// is safer than a runtime vowel-harmony algorithm for six known words.
export const PRAYER_LABEL_DATIVE: Record<PrayerName, string> = {
  imsak: "İmsak'a",
  gunes: "Güneş'e",
  ogle: "Öğle'ye",
  ikindi: "İkindi'ye",
  aksam: "Akşam'a",
  yatsi: "Yatsı'ya",
};

type KerahetType = KerahetInfo['type'];

export const KERAHET_SHORT_LABEL: Record<KerahetType, string> = {
  gunes_sonrasi: 'İşrâk',
  ogle_oncesi: 'İstivâ',
  aksam_oncesi: 'Gurûb',
};

export const KERAHET_WINDOW_TITLE: Record<KerahetType, string> = {
  gunes_sonrasi: 'İşrâk Vakti',
  ogle_oncesi: 'İstivâ Vakti',
  aksam_oncesi: 'Gurûb Vakti',
};

export const KERAHET_WINDOW_DESCRIPTION: Record<KerahetType, string> = {
  gunes_sonrasi: 'Güneş doğduktan sonra yaklaşık 45 dakika süren bu aralıkta nafile namaz kılınmaz.',
  ogle_oncesi: 'Güneşin tam tepede olduğu ana kadar süren ~45 dakikalık aralıkta nafile namaz kılınmaz.',
  aksam_oncesi: 'Güneş batmadan önceki ~45 dakikada nafile namaz kılınmaz; günün ikindi namazı bu vakitte kılınabilir.',
};
