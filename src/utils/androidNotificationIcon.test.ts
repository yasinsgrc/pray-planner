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

// Kubbe + kasnak siluetinin assets/logo/_v8/launcher-foreground.svg içindeki
// kubbe ve kasnak alt-path'lerinin 0.14 ölçek + merkezleme dönüşümüyle
// 24dp viewport'a taşınmış, birebir aynı hali olması gerekiyor.
test('ic_stat_vakit.xml pathData is the scaled dome+drum silhouette from the v8 launcher foreground', () => {
  const pathDataMatch = drawable.match(/android:pathData="([^"]+)"/);
  assert.equal(
    pathDataMatch?.[1],
    'M12,1.95 C13.28,4.82 18.7,8.33 19.02,11.84 C19.02,13.76 19.02,15.35 17.75,16.31 L6.25,16.31 C4.98,15.35 4.98,13.76 4.98,11.84 C5.3,8.33 10.72,4.82 12,1.95 Z M6.09,16.31 L17.91,16.31 L17.91,22.05 L6.09,22.05 Z',
  );
});
