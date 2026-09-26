import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Sistem yazı boyutu WebView textZoom'u ile değil, --os-font-scale → html
// font-size (rem) yoluyla uygulanır; böylece cihaz ve visual-check aynı
// mekanizmayı kullanır (textZoom rem kutularını büyütmez, yalnızca metni).
const root = path.join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
const css = read('src/index.css');
const javaDir = 'android/app/src/main/java/com/vakit';

test('index.css :root --os-font-scale varsayilani 1', () => {
  assert.equal(css.match(/--os-font-scale:\s*([^;]+);/)?.[1], '1');
});

test('index.css --ui-scale sistem olcegini 1..1.3 araligina sikistirir', () => {
  assert.equal(css.match(/--ui-scale:\s*([^;]+);/)?.[1], 'clamp(1, var(--os-font-scale), 1.3)');
});

test('index.css html font-size --ui-scale ile olceklenir', () => {
  const htmlRules = [...css.matchAll(/(?:^|\}|\*\/)\s*html\s*\{([^}]*)\}/g)].map((m) => m[1]);
  const sizes = htmlRules.map((b) => b.match(/font-size:\s*([^;]+);/)?.[1]).filter(Boolean);
  assert.deepEqual(sizes, ['calc(100% * var(--ui-scale))']);
});

test('native: textZoom yalnizca FontScalePlugin.kt icinde 100e sabitlenir', () => {
  const lines = ['MainActivity.java', 'FontScalePlugin.kt']
    .flatMap((f) => {
      try {
        return read(`${javaDir}/${f}`).split('\n');
      } catch {
        return [];
      }
    })
    .map((l) => l.trim())
    .filter((l) => /textZoom|TextZoom/.test(l) && !l.startsWith('//') && !l.startsWith('*'));
  assert.deepEqual(lines, ['bridge.webView.settings.textZoom = 100']);
});

test('native: FontScalePlugin super.onCreate oncesinde kaydedilir', () => {
  const src = read(`${javaDir}/MainActivity.java`);
  const reg = src.indexOf('registerPlugin(FontScalePlugin.class);');
  const sup = src.indexOf('super.onCreate(savedInstanceState);');
  assert.equal(reg !== -1 && reg < sup, true);
});

test('AndroidManifest configChanges fontScale icermez (olcek degisince activity yeniden olusur)', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const changes = manifest.match(/android:configChanges="([^"]+)"/)?.[1].split('|') ?? [];
  assert.equal(changes.includes('fontScale'), false);
});

// Fallback yolu: DOCUMENT_START_SCRIPT desteklenmeyen WebView'de native
// değişkeni önceden yazamaz; web render öncesi eklentiden okur.
const nativeState = { value: false };
const getFontScale = mock.fn(async () => ({ fontScale: 1.5 }));
const setProperty = mock.fn((_k: string, _v: string) => {});
const current = { value: '' };

let ensureOsFontScale: typeof import('./osFontScale').ensureOsFontScale;

before(async () => {
  mock.module('@capacitor/core', {
    namedExports: {
      registerPlugin: () => ({ getFontScale }),
      Capacitor: { isNativePlatform: () => nativeState.value },
    },
  });
  (globalThis as { document?: unknown }).document = {
    documentElement: {
      style: { getPropertyValue: () => current.value, setProperty },
    },
  };
  ({ ensureOsFontScale } = await import('./osFontScale'));
});

beforeEach(() => {
  getFontScale.mock.resetCalls();
  setProperty.mock.resetCalls();
  nativeState.value = false;
  current.value = '';
});

test('web/PWA: eklenti cagrilmaz, degisken yazilmaz', async () => {
  await ensureOsFontScale();
  assert.equal(getFontScale.mock.callCount(), 0);
  assert.equal(setProperty.mock.callCount(), 0);
});

test('native + document-start script zaten yazmis: eklenti cagrilmaz', async () => {
  nativeState.value = true;
  current.value = '1.5';
  await ensureOsFontScale();
  assert.equal(getFontScale.mock.callCount(), 0);
  assert.equal(setProperty.mock.callCount(), 0);
});

test('native + degisken yok: eklentiden okunur ve html uzerine yazilir', async () => {
  nativeState.value = true;
  await ensureOsFontScale();
  assert.equal(getFontScale.mock.callCount(), 1);
  assert.deepEqual(setProperty.mock.calls.map((c) => c.arguments), [['--os-font-scale', '1.5']]);
});
