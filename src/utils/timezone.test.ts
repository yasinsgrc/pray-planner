import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessTimeZone, resolveTimeZone } from './timezone';

test('guessTimeZone identifies Istanbul coordinates as Europe/Istanbul', () => {
  assert.equal(guessTimeZone(41.0264, 29.0152), 'Europe/Istanbul');
});

test('guessTimeZone identifies Mecca coordinates as Asia/Riyadh', () => {
  assert.equal(guessTimeZone(21.4225, 39.8262), 'Asia/Riyadh');
});

test('guessTimeZone falls back to the device zone for an unmapped location', () => {
  // Deep in the Pacific — not covered by any region box.
  const result = guessTimeZone(-10, -150);
  assert.equal(result, Intl.DateTimeFormat().resolvedOptions().timeZone);
});

test('resolveTimeZone prefers an explicit timeZone over guessing', () => {
  assert.equal(resolveTimeZone({ lat: 21.4225, lng: 39.8262, timeZone: 'Europe/Istanbul' }), 'Europe/Istanbul');
});

test('resolveTimeZone guesses when timeZone is absent', () => {
  assert.equal(resolveTimeZone({ lat: 21.4225, lng: 39.8262 }), 'Asia/Riyadh');
});
