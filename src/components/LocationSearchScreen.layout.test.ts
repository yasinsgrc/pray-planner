import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Same source-text-assertion pattern as BottomSheet.keyboardLayout.test.ts —
// this component is portal-rendered to document.body, which doesn't exist
// under node:test's SSR-only environment. Real pixel/layout outcome is
// verified by `npm run visual` (checkLocationSearchKeyboardStability).
const source = readFileSync(path.join(import.meta.dirname, 'LocationSearchScreen.tsx'), 'utf8');

test('root layer is fixed inset-0, never dvh — dvh is what caused the original keyboard bug', () => {
  assert.match(source, /fixed inset-0/);
  assert.doesNotMatch(source, /dvh/);
});

test('no sticky positioning — the top block is a shrink-0 flex sibling, not sticky inside the scroll container', () => {
  assert.doesNotMatch(source, /sticky/);
});

test('exactly one scroll container (overflow-y-auto appears once)', () => {
  const matches = source.match(/overflow-y-auto/g) ?? [];
  assert.equal(matches.length, 1);
});

test('keyboard overlap value is only ever used in paddingBottom, never height/maxHeight/transform/translateY', () => {
  assert.doesNotMatch(source, /(height|maxHeight|transform|translateY)[^\n]*keyboardOverlap/);
  assert.match(source, /paddingBottom[^\n]*keyboardOverlap/);
});

test('bottom padding uses max(), not addition — keyboard and safe-area-inset-bottom must not be double-counted', () => {
  assert.match(source, /max\(env\(safe-area-inset-bottom\)/);
});

test('search input font size never drops below 16px (mobile focus-zoom / readability)', () => {
  const inputMatch = source.match(/<input[\s\S]*?\/>/);
  assert.ok(inputMatch, 'arama input bulunamadı');
  const inputBlock = inputMatch[0];
  assert.doesNotMatch(inputBlock, /text-xs/);
  assert.doesNotMatch(inputBlock, /text-\[1[0-5]px\]/);
});

test('regression: animate-spin-slow is applied only while isLocating, never unconditionally', () => {
  assert.doesNotMatch(source, /className="[^"]*animate-spin-slow[^"]*"/);
  assert.match(source, /isLocating[\s\S]{0,60}animate-spin-slow/);
});
