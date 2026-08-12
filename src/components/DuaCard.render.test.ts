import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DuaCard } from './DuaCard';

// Faz 25 Commit 2 — imsak ilerleme çubuğunun yerine geçen sabit dua kartı.
// Kapalıyken Arapça + okunuş + meal görünür; kaynak yalnızca dokununca açılır.
//
// DuaCard'ın kendi `dua` prop'u (test seam), dualar.ts'teki gerçek üretim
// içeriğinden bağımsız, kısa/sabit bir fixture ile yapı testi yapmak için
// var — bu dosya yapıyı (aria, dir/lang, touch target) doğrular, gerçek dua
// metninin doğruluğunu değil.
const FIXTURE_DUA = {
  arabic: 'ARAPCA_ORNEK',
  transliteration: 'OKUNUS_ORNEK',
  meaning: 'MEAL_ORNEK',
  source: 'KAYNAK_ORNEK',
};

test('DuaCard shows arabic + transliteration + meaning by default; source panel is present but hidden', () => {
  const html = renderToStaticMarkup(React.createElement(DuaCard, { dua: FIXTURE_DUA }));

  assert.match(html, /ARAPCA_ORNEK/);
  assert.match(html, /OKUNUS_ORNEK/);
  assert.match(html, /MEAL_ORNEK/);
  // Source lives inside the aria-controls panel, which must carry the
  // `hidden` attribute by default (collapsed) — not be absent from the DOM
  // (aria-controls must reference a real element) and not be merely
  // opacity/visibility-hidden (still occupies layout).
  assert.match(html, /id="dua-card-panel" hidden=""/);
  assert.match(html, /KAYNAK_ORNEK/); // present in DOM, just hidden
});

test('DuaCard toggle button has aria-expanded=false and aria-controls pointing at a matching id', () => {
  const html = renderToStaticMarkup(React.createElement(DuaCard, { dua: FIXTURE_DUA }));

  assert.match(html, /aria-expanded="false"/);
  const controlsMatch = html.match(/aria-controls="([^"]+)"/);
  assert.ok(controlsMatch, 'aria-controls attribute bulunamadı');
  const targetId = controlsMatch![1];
  assert.match(html, new RegExp(`id="${targetId}"`));
});

test('DuaCard arabic element uses dir="rtl", lang="ar" and the self-hosted arabic font class', () => {
  const html = renderToStaticMarkup(React.createElement(DuaCard, { dua: FIXTURE_DUA }));

  assert.match(html, /dir="rtl"/);
  assert.match(html, /lang="ar"/);
  assert.match(html, /font-arabic/);
});

test('DuaCard has a 44px-minimum touch target on its toggle control', () => {
  const html = renderToStaticMarkup(React.createElement(DuaCard, { dua: FIXTURE_DUA }));

  assert.match(html, /min-h-\[44px\]/);
});

// Faz 25 Commit 3 — gerçek dua içeriği dualar.ts'e girildi (Ümmü Seleme
// rivayeti, Tirmizî Kader 7/Daavât 90,124). Üretimde kullanılan DUALAR[0]'ın
// artık placeholder köşeli parantez işaretçileri taşımadığını doğrular —
// bu, 360x640'ta scroll'a yol açan asıl kaynaktı (kart 96px bütçesinin
// üstünde, 188px'e kadar çıkıyordu).
test('DuaCard renders the real production dua by default, not a bracketed placeholder', () => {
  const html = renderToStaticMarkup(React.createElement(DuaCard));

  assert.doesNotMatch(html, /&lt;&lt;/); // '<<' HTML-escaped — no leftover placeholder marker
  assert.match(html, /يَا مُقَلِّبَ الْقُلُوبِ/);
});
