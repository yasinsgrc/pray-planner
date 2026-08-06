import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeHtmlEntities } from './htmlEntities';

test('decodeHtmlEntities decodes named entities without touching the surrounding words', () => {
  assert.equal(decodeHtmlEntities('O, &quot;Rabbimiz&quot; dedi.'), 'O, "Rabbimiz" dedi.');
  assert.equal(decodeHtmlEntities('Allah&#39;ın rahmeti'), "Allah'ın rahmeti");
  assert.equal(decodeHtmlEntities('bu &amp; şu'), 'bu & şu');
  assert.equal(decodeHtmlEntities('&lt;tag&gt;'), '<tag>');
  assert.equal(decodeHtmlEntities('a&nbsp;b'), 'a b');
});

test('decodeHtmlEntities decodes numeric decimal and hex entities', () => {
  assert.equal(decodeHtmlEntities('&#39;merhaba&#39;'), "'merhaba'");
  assert.equal(decodeHtmlEntities('&#x27;merhaba&#x27;'), "'merhaba'");
});

test('decodeHtmlEntities leaves plain text with no entities completely unchanged', () => {
  const plain = 'Rabbimiz bize dünyada da iyilik ver, ahirette de iyilik ver.';
  assert.equal(decodeHtmlEntities(plain), plain);
});

// Turkish-specific letters: ç/ü/ö have standard HTML5 named entities;
// ş/ğ/ı do NOT (no named form exists in the HTML5 spec), so a real Quran
// translation API is likely to send THOSE as numeric refs — decimal or
// hex — not named ones. Both paths must work (design-refresh-v3 Faz 21
// madde 1).
test('decodeHtmlEntities decodes Turkish letters via named entities (ç/ü/ö)', () => {
  assert.equal(decodeHtmlEntities('g&uuml;zel'), 'güzel');
  assert.equal(decodeHtmlEntities('k&ouml;t&uuml;'), 'kötü');
  assert.equal(decodeHtmlEntities('a&ccedil;'), 'aç');
  assert.equal(decodeHtmlEntities('&Ccedil;ok'), 'Çok');
});

test('decodeHtmlEntities decodes Turkish letters with no named form (ş/ğ/ı) via decimal refs', () => {
  assert.equal(decodeHtmlEntities('&#231;'), 'ç');
  assert.equal(decodeHtmlEntities('&#252;'), 'ü');
  assert.equal(decodeHtmlEntities('&#246;'), 'ö');
  assert.equal(decodeHtmlEntities('&#286;'), 'Ğ');
  assert.equal(decodeHtmlEntities('&#305;'), 'ı');
});

test('decodeHtmlEntities decodes the same Turkish letters via hex refs', () => {
  assert.equal(decodeHtmlEntities('&#xE7;'), 'ç');
  assert.equal(decodeHtmlEntities('&#xFC;'), 'ü');
  assert.equal(decodeHtmlEntities('&#xF6;'), 'ö');
});

// One decode pass only, never a loop until stable — an API that
// double-encoded a quote (" -> &quot; -> &amp;quot;) must come back as the
// literal, still-once-escaped text "&quot;", not the fully resolved
// character. Looping to "fix" that would be actively wrong: it would also
// unwrap a LEGITIMATE literal "&amp;quot;" in someone's actual message
// into a quote that was never there.
test('decodeHtmlEntities resolves double-escaped input by exactly one level, not recursively', () => {
  assert.equal(decodeHtmlEntities('&amp;quot;iyi&amp;quot;'), '&quot;iyi&quot;');
  assert.equal(decodeHtmlEntities('&amp;uuml;'), '&uuml;');
});

test('decodeHtmlEntities leaves malformed entity-like text exactly as-is, without throwing', () => {
  assert.equal(decodeHtmlEntities('&'), '&');
  assert.equal(decodeHtmlEntities('&;'), '&;');
  assert.equal(decodeHtmlEntities('&#;'), '&#;');
  assert.equal(decodeHtmlEntities('&#xZZ;'), '&#xZZ;');
  assert.equal(decodeHtmlEntities('a & b'), 'a & b');
  assert.equal(decodeHtmlEntities('5 < 10 > 3'), '5 < 10 > 3');
});

test('decodeHtmlEntities is safe on empty, null, and undefined input', () => {
  assert.equal(decodeHtmlEntities(''), '');
  assert.equal(decodeHtmlEntities(null), '');
  assert.equal(decodeHtmlEntities(undefined), '');
});
