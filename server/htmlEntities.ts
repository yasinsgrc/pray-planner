const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: '&',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  // ç/ü/ö have standard HTML5 named forms; ş/ğ/ı do not (no named entity
  // exists for them in the spec) — those only ever arrive as numeric
  // refs, already handled by the decimal/hex passes above this table.
  ccedil: 'ç',
  Ccedil: 'Ç',
  uuml: 'ü',
  Uuml: 'Ü',
  ouml: 'ö',
  Ouml: 'Ö',
};

/**
 * Decodes the handful of HTML entities that show up as literal text
 * (design-refresh-v3 Faz 20 madde 2) — the ummahapi.com verse translation
 * field comes back HTML-encoded, and nothing decoded it before display, so
 * "&quot;" etc. showed up verbatim instead of the character it stands for.
 * Deliberately NOT a general-purpose HTML decoder (no dependency, no tag
 * stripping) — this only ever runs on plain translated text.
 *
 * Exactly one decode pass, never a loop until the string stops changing —
 * a source that double-encoded a character (" -> &quot; -> &amp;quot;)
 * must come back as the literal, still-once-escaped "&quot;", not fully
 * resolved. Looping would also wrongly unwrap a genuine, never-escaped
 * "&amp;quot;" appearing in someone's real text.
 *
 * `null`/`undefined` are accepted defensively and return '' — this reads
 * fields straight out of a third-party API's untyped JSON response, which
 * can disagree with what the TypeScript types above it claim (design-
 * refresh-v3 Faz 21 madde 1).
 */
export function decodeHtmlEntities(text: string | null | undefined): string {
  if (text == null) return '';
  // HTML entity names are case-sensitive (&Ccedil; != &ccedil;) — no
  // .toLowerCase() here, or the two would collide in NAMED_ENTITIES.
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name] ?? match);
}
