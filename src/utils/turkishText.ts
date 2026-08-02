/**
 * Case- and accent-insensitive matching for Turkish text (design-refresh-v3
 * Faz 6 B1) — "gebze", "Gebze", "GEBZE" must all match the same location.
 * Plain .toLowerCase() isn't enough: it doesn't fold ı/İ/ş/ğ/ç/ö/ü onto
 * their unaccented Latin equivalents, so a query typed without Turkish
 * keyboard input (e.g. "sirnak" for "Şırnak") would never match otherwise.
 */
const TURKISH_CHAR_MAP: Record<string, string> = {
  ı: 'i',
  İ: 'i',
  I: 'i',
  ş: 's',
  Ş: 's',
  ğ: 'g',
  Ğ: 'g',
  ç: 'c',
  Ç: 'c',
  ö: 'o',
  Ö: 'o',
  ü: 'u',
  Ü: 'u',
};

export function normalizeTurkish(input: string): string {
  let result = '';
  for (const ch of input) {
    result += TURKISH_CHAR_MAP[ch] ?? ch.toLowerCase();
  }
  return result;
}
