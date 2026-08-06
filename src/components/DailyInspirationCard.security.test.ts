import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { decodeHtmlEntities } from '../../server/htmlEntities';

/**
 * Design-refresh-v3 Faz 21 madde 1 — decodeHtmlEntities turns
 * "&lt;script&gt;" into a literal "<script>" string. That is only safe
 * because the ONE place that renders the daily verse (DailyInspirationCard)
 * interpolates it as a plain JSX text child, which React always
 * HTML-escapes on the way to the DOM — never via dangerouslySetInnerHTML.
 * Both halves are checked: a static source scan (regression guard against
 * someone adding dangerouslySetInnerHTML later) and a real render proving
 * React's own escaping actually holds for decoded, attacker-controlled text.
 */

test('DailyInspirationCard.tsx never uses dangerouslySetInnerHTML', () => {
  const source = readFileSync(path.join(import.meta.dirname, 'DailyInspirationCard.tsx'), 'utf8');
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

test('no component under src/components uses dangerouslySetInnerHTML anywhere', () => {
  const dir = import.meta.dirname;
  const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'));
  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(path.join(dir, file), 'utf8');
    if (/dangerouslySetInnerHTML/.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test('decoding an HTML-escaped script tag and rendering it the way DailyInspirationCard does produces escaped text, not a script element', () => {
  // Exactly what an API would send if it (wrongly) HTML-encoded a
  // string containing markup: "<script>alert(1)</script>" encoded once.
  const escapedFromApi = '&lt;script&gt;alert(1)&lt;/script&gt;';
  const decoded = decodeHtmlEntities(escapedFromApi);
  assert.equal(decoded, '<script>alert(1)</script>');

  // The real render path: {verseText} as a plain JSX text child — the
  // exact pattern used at DailyInspirationCard.tsx's `{tab === 'verse' && verseText}`.
  const html = renderToStaticMarkup(React.createElement('p', null, decoded));

  assert.doesNotMatch(html, /<script[\s>]/i);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
