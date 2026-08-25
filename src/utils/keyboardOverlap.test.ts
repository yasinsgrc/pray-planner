import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeKeyboardOverlap } from './keyboardOverlap';

test('native resize regime: innerHeight already shrunk, no overlap reported', () => {
  assert.equal(computeKeyboardOverlap(500, 500, 0), 0);
});

test('overlay regime: visualViewport shrunk while innerHeight stays full, reports keyboard height', () => {
  assert.equal(computeKeyboardOverlap(844, 500, 0), 344);
});

test('adjustPan regime: offsetTop accounts for the pan offset already applied', () => {
  assert.equal(computeKeyboardOverlap(844, 500, 200), 144);
});

test('negative guard: visualViewport taller than innerHeight never yields a negative overlap', () => {
  assert.equal(computeKeyboardOverlap(500, 600, 0), 0);
});

test('threshold: raw overlap under 80px is rounding noise, not a keyboard', () => {
  assert.equal(computeKeyboardOverlap(844, 800, 0), 0);
});

test('threshold: raw overlap at 84px clears the noise floor and is reported', () => {
  assert.equal(computeKeyboardOverlap(844, 760, 0), 84);
});
