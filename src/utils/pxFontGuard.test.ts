import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// Sabit px font boyutu --ui-scale (rem) ölçeğine katılmaz; sistem yazı
// boyutu büyüyünce düzen tutarsız büyür. Tüm font boyutları rem olmalı.
// Kasıtlı istisna gerekirse buraya `dosya: gerekçe` olarak eklenir.
const ALLOWLIST: Record<string, string> = {
  'components/QiblaCompassView.tsx':
    'Kıble görünümü bu düzeltmenin kapsamı dışında (ayrı iş); 17 adet text-[Npx] bilinçli olarak bırakıldı.',
};

const srcDir = path.join(import.meta.dirname, '..');
const PX_FONT = [
  /text-\[\d+(?:\.\d+)?px\]/g,
  // React'te birimsiz sayı px demektir: fontSize: 12 ve fontSize: '12px'.
  /fontSize:\s*(?:['"`]\d+(?:\.\d+)?px['"`]|\d)/g,
  /font-size:\s*[^;]*\d+(?:\.\d+)?px/g,
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test('src altinda px tabanli font boyutu yok', () => {
  const files = walk(srcDir).filter((f) => f.endsWith('.tsx') || f.endsWith('index.css'));
  const hits = files.flatMap((f) => {
    const rel = path.relative(srcDir, f).replaceAll('\\', '/');
    if (rel in ALLOWLIST) return [];
    const src = readFileSync(f, 'utf8');
    return PX_FONT.flatMap((re) => (src.match(re) ?? []).map((m) => `${rel}: ${m}`));
  });
  assert.equal(hits.length, 0, hits.join('\n'));
});
