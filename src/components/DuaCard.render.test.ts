import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DuaCard } from './DuaCard';

// Faz 25 Commit 2 — imsak ilerleme çubuğunun yerine geçen sabit dua kartı.
// Kapalıyken Arapça + meal görünür (Arapça okuyan okunuşa bakmaz, okuyamayan
// Arapça satırını atlar); okunuş + kaynak yalnızca dokununca açılır —
// dördünü aynı anda göstermek kartı büyütüp çember için ayrılan alanı yer.

test('DuaCard shows arabic + meaning by default; transliteration/source panel is present but hidden', () => {
  const html = renderToStaticMarkup(React.createElement(DuaCard));

  // HTML-escaped rendering (&lt;&gt;&#x27;) — assert on the un-escapable
  // Turkish core words instead of the raw placeholder string with < > '.
  assert.match(html, /ARAPÇA METİN/);
  assert.match(html, /MEAL — Diyanet/);
  // Transliteration/source live inside the aria-controls panel, which must
  // carry the `hidden` attribute by default (collapsed) — not be absent
  // from the DOM (aria-controls must reference a real element) and not be
  // merely opacity/visibility-hidden (still occupies layout).
  assert.match(html, /id="dua-card-panel" hidden=""/);
  assert.match(html, /OKUNUŞ —/); // present in DOM, just hidden
});

test('DuaCard toggle button has aria-expanded=false and aria-controls pointing at a matching id', () => {
  const html = renderToStaticMarkup(React.createElement(DuaCard));

  assert.match(html, /aria-expanded="false"/);
  const controlsMatch = html.match(/aria-controls="([^"]+)"/);
  assert.ok(controlsMatch, 'aria-controls attribute bulunamadı');
  const targetId = controlsMatch![1];
  assert.match(html, new RegExp(`id="${targetId}"`));
});

test('DuaCard arabic element uses dir="rtl", lang="ar" and the self-hosted arabic font class', () => {
  const html = renderToStaticMarkup(React.createElement(DuaCard));

  assert.match(html, /dir="rtl"/);
  assert.match(html, /lang="ar"/);
  assert.match(html, /font-arabic/);
});

test('DuaCard has a 44px-minimum touch target on its toggle control', () => {
  const html = renderToStaticMarkup(React.createElement(DuaCard));

  assert.match(html, /min-h-\[44px\]/);
});
