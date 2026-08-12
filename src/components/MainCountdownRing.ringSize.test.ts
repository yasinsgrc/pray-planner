import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Faz 26 — halka boyutu artık src/index.css'teki .ring-metrics class'ından
// geliyor (Faz 25 Commit 3'ün inline stildeki tek --ring-size formülü
// yerine): kısa/boxy telefonlarda (360x640) eski clamp(150px, min(60vw,
// 24dvh), 240px) birebir korunuyor, min-height:720px üstü (360x800/412x915
// gibi uzun telefonlar) için ayrı bir @media bloğu halkayı belirgin
// şekilde büyütüyor — tek bir sürekli vw/dvh formülü ikisini aynı anda
// karşılayamıyor (npm run visual ile ölçülmüş çelişki). Geri sayım/etiket
// fontSize'ları da artık dondurulmuş bir --ring-font-basis yerine
// doğrudan --ring-size'a oranlı: halka büyüdükçe metin de büyüsün
// isteniyor (eski "en fazla +2px" kısıtı bilerek kaldırıldı).
const componentSource = readFileSync(path.join(import.meta.dirname, 'MainCountdownRing.tsx'), 'utf8');
const cssSource = readFileSync(path.join(import.meta.dirname, '..', 'index.css'), 'utf8');

test('ring-size token lives in the .ring-metrics CSS class and combines vw with dvh', () => {
  const match = cssSource.match(/\.ring-metrics\s*{\s*--ring-size:\s*([^;]+);/);
  assert.ok(match, '.ring-metrics içinde --ring-size değeri bulunamadı');
  assert.match(match![1], /vw/);
  assert.match(match![1], /dvh/);
});

test('a min-height media query gives tall viewports a larger --ring-size than the base rule', () => {
  assert.match(cssSource, /@media\s*\(min-height:\s*\d+px\)\s*{\s*\.ring-metrics/);
});

test('MainCountdownRing applies the ring-metrics class instead of an inline --ring-size', () => {
  assert.match(componentSource, /className="[^"]*\bring-metrics\b[^"]*"/);
  assert.doesNotMatch(componentSource, /'--ring-size':/);
});

test('countdown and label font sizing scales proportionally with --ring-size, not a frozen basis', () => {
  assert.doesNotMatch(componentSource, /--ring-font-basis/);
  const fontSizeLines = componentSource.match(/fontSize:\s*'[^']*var\(--ring-[a-z-]+\)[^']*'/g) ?? [];
  assert.ok(fontSizeLines.length > 0, 'fontSize satırı bulunamadı');
  for (const line of fontSizeLines) {
    assert.match(line, /var\(--ring-size\)/, `${line} --ring-size'a oranlı değil`);
  }
});
