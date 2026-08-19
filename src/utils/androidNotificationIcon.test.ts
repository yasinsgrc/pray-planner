import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Bildirim çubuğunda uygulama ikonu yerine "İ" fallback'i çiziliyordu çünkü
// capacitor.config.ts içindeki smallIcon: 'ic_stat_vakit' hiçbir drawable'a
// karşılık gelmiyordu. Android status bar ikonunu sadece alpha kanalından
// çizer; renkli/çok renkli bir path verilirse yine bozuk görünür — bu yüzden
// drawable'ın tek renkli (yalnızca #FFFFFF dolgu) olduğunu doğruluyoruz.
const drawable = readFileSync('android/app/src/main/res/drawable/ic_stat_vakit.xml', 'utf-8');
const capacitorConfig = readFileSync('capacitor.config.ts', 'utf-8');

test('ic_stat_vakit.xml is a 24dp vector drawable', () => {
  assert.equal(drawable.includes('android:width="24dp"'), true);
  assert.equal(drawable.includes('android:height="24dp"'), true);
  assert.equal(drawable.includes('android:viewportWidth="24"'), true);
  assert.equal(drawable.includes('android:viewportHeight="24"'), true);
});

test('ic_stat_vakit.xml uses a single monochrome white fill (status bar icons only read alpha)', () => {
  const fillColors = [...drawable.matchAll(/android:fillColor="(#[0-9A-Fa-f]{6,8})"/g)].map((m) => m[1]);
  assert.equal(fillColors.length > 0, true);
  assert.deepEqual([...new Set(fillColors)], ['#FFFFFF']);
});

test('ic_stat_vakit.xml has no gradient or multi-color paths', () => {
  assert.equal(drawable.includes('gradient'), false);
});

test('capacitor.config.ts smallIcon matches the ic_stat_vakit drawable', () => {
  assert.equal(capacitorConfig.includes("smallIcon: 'ic_stat_vakit'"), true);
});
