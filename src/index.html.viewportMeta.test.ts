import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// index.html lives at the repo root, not under src/, but npm run test:frontend
// only globs src/**/*.test.ts — co-locating this test here (like
// BottomSheet.keyboardLayout.test.ts asserts on BottomSheet.tsx source) keeps
// it inside that glob while still reading the real root file.
const source = readFileSync(path.join(import.meta.dirname, '..', 'index.html'), 'utf8');

test('regression: viewport meta does not use interactive-widget=resizes-content, which double-resizes dvh on top of native adjustResize', () => {
  assert.doesNotMatch(source, /interactive-widget=resizes-content/);
});

test('viewport meta keeps viewport-fit=cover for safe-area insets', () => {
  assert.match(source, /viewport-fit=cover/);
});
