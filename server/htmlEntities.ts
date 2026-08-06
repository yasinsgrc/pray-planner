const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: '&',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

/**
 * Decodes the handful of HTML entities that show up as literal text
 * (design-refresh-v3 Faz 20 madde 2) — the ummahapi.com verse translation
 * field comes back HTML-encoded, and nothing decoded it before display, so
 * "&quot;" etc. showed up verbatim instead of the character it stands for.
 * Deliberately NOT a general-purpose HTML decoder (no dependency, no tag
 * stripping) — this only ever runs on plain translated text.
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}
