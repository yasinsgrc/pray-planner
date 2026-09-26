import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { THEME_BG } from './themeColors';

// Tema zemin rengi dört yerde tekrar ediyor: index.css (--bg-current),
// index.html (theme-color meta), Android res (vakit_bg — hidrasyon öncesi
// ilk kare) ve StatusBarAppearancePlugin'e giden backgroundColor. Biri
// kayarsa durum çubuğu şeridi uygulama zemininden farklı renkte görünür.
const root = path.join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

const css = read('src/index.css');

function bgCurrentIn(block: string): string {
  const m = block.match(/--bg-current:\s*(#[0-9A-Fa-f]{6})\s*;/);
  assert.ok(m, '--bg-current bulunamadı');
  return m[1];
}

test('index.css :root --bg-current acik tema sabitine esit', () => {
  const rootBlock = css.slice(css.indexOf(':root'), css.indexOf('.dark {'));
  assert.equal(bgCurrentIn(rootBlock), THEME_BG.light);
});

test('index.css .dark --bg-current koyu tema sabitine esit', () => {
  const darkBlock = css.slice(css.indexOf('.dark {'));
  assert.equal(bgCurrentIn(darkBlock), THEME_BG.dark);
});

test('index.html theme-color meta etiketleri tema sabitlerine esit', () => {
  const html = read('index.html');
  const light = html.match(/<meta name="theme-color" content="(#[0-9A-Fa-f]{6})" media="\(prefers-color-scheme: light\)"/);
  const dark = html.match(/<meta name="theme-color" content="(#[0-9A-Fa-f]{6})" media="\(prefers-color-scheme: dark\)"/);
  assert.equal(light?.[1], THEME_BG.light);
  assert.equal(dark?.[1], THEME_BG.dark);
});

test('Android values/colors.xml vakit_bg acik tema sabitine esit', () => {
  const xml = read('android/app/src/main/res/values/colors.xml');
  assert.equal(xml.match(/<color name="vakit_bg">(#[0-9A-Fa-f]{6})<\/color>/)?.[1], THEME_BG.light);
});

test('Android values-night/colors.xml vakit_bg koyu tema sabitine esit', () => {
  let xml = '';
  try {
    xml = read('android/app/src/main/res/values-night/colors.xml');
  } catch {
    // dosya yoksa eşitlik aşağıda kırmızı olur
  }
  assert.equal(xml.match(/<color name="vakit_bg">(#[0-9A-Fa-f]{6})<\/color>/)?.[1], THEME_BG.dark);
});

test('AppTheme.NoActionBar pencere arka plani vakit_bg', () => {
  const xml = read('android/app/src/main/res/values/styles.xml');
  const block = xml.match(/<style name="AppTheme\.NoActionBar"[\s\S]*?<\/style>/)?.[0] ?? '';
  assert.equal(block.match(/<item name="android:windowBackground">([^<]+)<\/item>/)?.[1], '@color/vakit_bg');
});

// Overscroll/elastik kaydırmada <html> zemini görünür; .dark <html>'e
// eklendiği için var(--bg-current) orada da doğru temayı çözer.
test('html ve body arka plani var(--bg-current)', () => {
  // Seçicisi tam olarak `html` / `body` olan kurallar (`html, body {…}` hariç).
  const rulesFor = (sel: string) =>
    [...css.matchAll(new RegExp(String.raw`(?:^|\}|\*\/)\s*${sel}\s*\{([^}]*)\}`, 'g'))].map((m) => m[1]);
  const bgOf = (sel: string) =>
    rulesFor(sel).map((body) => body.match(/background-color:\s*([^;]+);/)?.[1]).filter(Boolean);
  assert.deepEqual(bgOf('html'), ['var(--bg-current)']);
  assert.deepEqual(bgOf('body'), ['var(--bg-current)']);
});
