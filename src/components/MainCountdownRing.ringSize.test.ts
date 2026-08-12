import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Faz 25 Commit 3 — halka boyutu artık viewport'a bağlı (sabit px değil).
// min(vw,dvh) kullanır (--ring-font-basis'in kanıtlanmış deseniyle aynı):
// saf bir vw formülü 360x640'ta (en kısa hedef viewport) main.scrollHeight'i
// clientHeight'in üstüne taşırıyordu (npm run visual ile ölçüldü — gerçek
// dua metniyle 55px taşma), dvh terimi kısa/geniş-oranlı viewport'larda
// devreye girip halkayı küçültüyor. Geri sayım rakamları ve etiketler ise
// --ring-size'dan AYRI, dondurulmuş bir referansa (--ring-font-basis, eski
// max(160px, min(72vw, 25dvh)) formülü) bağlı kalmalı — halka büyürken
// yazı orantılı büyürse ekranı ezer (spesifikasyon: "en fazla +2px").
const source = readFileSync(path.join(import.meta.dirname, 'MainCountdownRing.tsx'), 'utf8');

test('ring-size is viewport-relative (not a fixed px value) and combines vw with dvh', () => {
  const match = source.match(/--ring-size['"]?\s*:\s*['"]([^'"]+)['"]/);
  assert.ok(match, '--ring-size değeri bulunamadı');
  assert.match(match![1], /vw/);
  assert.match(match![1], /dvh/);
});

test('font sizing stays on a frozen --ring-font-basis, not the enlarged --ring-size', () => {
  assert.match(source, /--ring-font-basis/);
  // Geri sayım/etiket font-size hesaplamaları --ring-size'ı DEĞİL,
  // --ring-font-basis'i çarpmalı.
  const fontSizeLines = source.match(/fontSize:\s*['"][^'"]*var\(--ring-[a-z-]+\)[^'"]*['"]/g) ?? [];
  assert.ok(fontSizeLines.length > 0, 'fontSize satırı bulunamadı');
  for (const line of fontSizeLines) {
    assert.doesNotMatch(line, /var\(--ring-size\)/, `${line} hâlâ --ring-size'a bağlı, --ring-font-basis'e taşınmalı`);
  }
});
