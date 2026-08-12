import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Faz 22 Commit 1 — "Sıradaki Vakit" (kart) ve "Tüm Vakitler" (buton) ana
// ekranda üçüncü/dördüncü kez aynı bilgiyi tekrarlıyordu: sıradaki vaktin
// adı ve saati zaten kadranın içindeki metinde (üst etiket + geri sayım) ve
// DialLegend'in altın vurgusunda görünüyor; "Tüm Vakitler" ise alt
// navigasyondaki Vakitler sekmesinin birebir kopyasıydı. Bu test, bento
// grid'in ve onunla birlikte gelen onScrollToFlow prop'unun geri
// gelmediğini garanti eder.
const source = readFileSync(path.join(import.meta.dirname, 'MainCountdownRing.tsx'), 'utf8');

test('MainCountdownRing no longer renders the "Sıradaki Vakit" card (duplicated by the dial + DialLegend)', () => {
  assert.doesNotMatch(source, /Sıradaki Vakit/);
});

test('MainCountdownRing no longer renders the "Tüm Vakitler" shortcut (duplicated by the Navbar\'s Vakitler tab)', () => {
  assert.doesNotMatch(source, /Tüm Vakitler/);
});

test('MainCountdownRing no longer accepts an onScrollToFlow prop', () => {
  assert.doesNotMatch(source, /onScrollToFlow/);
});

// Faz 24 Commit 5'in Kıble/Tesbih/İmsakiye/Bildirim çipleri, aynı hedeflere
// zaten var olan ikinci giriş noktalarıydı (Kıble/Tesbih Maneviyat
// sekmesinde, İmsakiye Vakitler sekmesinde, Bildirim Ayarlar sekmesinde) —
// "Tüm Vakitler" ile birebir aynı hata deseni. Bu test o çip bloğunun geri
// gelmediğini garanti eder.
test('MainCountdownRing no longer imports or renders QuickAccessChips', () => {
  assert.doesNotMatch(source, /QuickAccessChips/);
});

test('MainCountdownRing still renders the contextual HomeContextSlot', () => {
  assert.match(source, /HomeContextSlot/);
});

// Faz 25 Commit 2 — "YARIN İMSAK X DK GEÇ" ve altındaki imsak ilerleme
// çubuğu (04:25 → 06:03, "1 sa 38 dk sürüyor") düşük değerliydi ve
// çemberi büyütmek için gereken dikey alanı tüketiyordu; ikisi de sabit
// bir dua kartıyla değiştirildi.
test('MainCountdownRing no longer imports or renders PrayerWindowBar', () => {
  assert.doesNotMatch(source, /PrayerWindowBar/);
});

test('MainCountdownRing renders the DuaCard in its place', () => {
  assert.match(source, /DuaCard/);
});
