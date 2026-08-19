import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeKeyboardOffset } from './useVisualViewportKeyboard';

test('computeKeyboardOffset returns how many px the keyboard has covered when the visual viewport shrinks', () => {
  assert.equal(computeKeyboardOffset(800, 480, 0), 320);
});

test('computeKeyboardOffset clamps to 0 when the visual viewport is not shrunk (no keyboard)', () => {
  assert.equal(computeKeyboardOffset(800, 800, 0), 0);
});

test('computeKeyboardOffset accounts for a non-zero visual viewport offsetTop (page scrolled while keyboard open)', () => {
  assert.equal(computeKeyboardOffset(800, 480, 20), 300);
});
