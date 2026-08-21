import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// BottomSheet is portal-rendered to document.body, which doesn't exist under
// node:test's SSR-only environment — it can't be mounted here. Like
// MainCountdownRing.ringSize.test.ts, this asserts the CSS/JSX declarations
// exist in source; the real pixel/layout outcome needs a real device or
// npm run visual (see also Navbar.safeArea.test.ts for the same limitation
// with env(safe-area-inset-bottom)).
const source = readFileSync(path.join(import.meta.dirname, 'BottomSheet.tsx'), 'utf8');
const cssSource = readFileSync(path.join(import.meta.dirname, '..', 'index.css'), 'utf8');

// Keyboard resize is handled by a single layer: native android:windowSoftInputMode
//="adjustResize" (see androidManifest.test.ts), which shrinks dvh directly.
// The JS visualViewport hook, the --kb-height CSS var, and the translateY
// offset were a second and third layer stacked on top of that, double- and
// triple-counting the keyboard height. This rewritten test asserts they're
// gone and stay gone, rather than asserting the old --kb-height contract.

test('regression: no visualViewport-based keyboard offset hook or CSS var — native adjustResize is the only resize layer', () => {
  assert.doesNotMatch(source, /useVisualViewportKeyboard/);
  assert.doesNotMatch(source, /window\.visualViewport/);
  assert.doesNotMatch(source, /--kb-height/);
});

test('regression: sheet max-height is plain 80dvh, no var(--kb-height) subtraction on top of native adjustResize', () => {
  assert.match(source, /maxHeight: '80dvh'/);
  assert.doesNotMatch(source, /calc\(100dvh - var\(--kb-height/);
});

test('regression: sheet is not translated by a JS keyboard offset — native adjustResize already repositions it', () => {
  assert.match(source, /animate=\{\{\s*y:\s*0\s*\}\}/);
});

test('bottom safe-area padding is a plain safe-area calc, no --kb-height back-off', () => {
  assert.match(source, /paddingBottom: 'calc\(env\(safe-area-inset-bottom\) \+ 24px\)'/);
});

test('sheet root stays a single flex column with one flex:1 min-h-0 overflow-y-auto scroll container', () => {
  assert.match(source, /flex flex-col/);
  assert.match(source, /flex-1 min-h-0 overflow-y-auto/);
});

test('no bare vh unit is used for the sheet — dvh only', () => {
  assert.doesNotMatch(source, /\dvh(?!\w)/);
});

test('regression: --kb-height design token is removed from :root, not just unused', () => {
  assert.doesNotMatch(cssSource, /--kb-height/);
});
