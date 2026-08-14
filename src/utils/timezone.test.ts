import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessTimeZone, resolveTimeZone, isFridayInZone } from './timezone';

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

test('isFridayInZone is true for a Friday in Europe/Istanbul', () => {
  // 2026-08-14 is a Friday.
  assert.equal(isFridayInZone(new Date('2026-08-14T09:00:00Z'), 'Europe/Istanbul'), true);
});

test('isFridayInZone is false for a Thursday in Europe/Istanbul', () => {
  // 2026-08-13 is a Thursday.
  assert.equal(isFridayInZone(new Date('2026-08-13T09:00:00Z'), 'Europe/Istanbul'), false);
});

test('isFridayInZone reads the target zone, not the instant\'s UTC day', () => {
  // 2026-08-14T01:00:00+03:00 (Friday, just after Istanbul midnight) is
  // still 2026-08-13T22:00:00Z (Thursday) in UTC — a naive `.getUTCDay()`
  // or device-local check would misread this as Thursday.
  assert.equal(isFridayInZone(new Date('2026-08-14T01:00:00+03:00'), 'Europe/Istanbul'), true);
});
