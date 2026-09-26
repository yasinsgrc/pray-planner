import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessTimeZone, resolveTimeZone, isFridayInZone, gpsTimeZone } from './timezone';

test('gpsTimeZone uses the device zone, not a guess or a nearby city\'s zone', () => {
  // Amsterdam: the nearest bundled location is London (Europe/London), which
  // GPS locations used to inherit. A GPS fix means the device is physically
  // there, so its own zone is the right one.
  assert.equal(gpsTimeZone(52.37, 4.9), Intl.DateTimeFormat().resolvedOptions().timeZone);
});

test('guessTimeZone identifies Istanbul coordinates as Europe/Istanbul', () => {
  assert.equal(guessTimeZone(41.0264, 29.0152), 'Europe/Istanbul');
});

test('guessTimeZone identifies Mecca coordinates as Asia/Riyadh', () => {
  assert.equal(guessTimeZone(21.4225, 39.8262), 'Asia/Riyadh');
});

// Regions are scanned in order, so a broad box listed first used to swallow
// a narrower one inside it (Dubai -> Riyadh, Kuala Lumpur -> Jakarta, Delhi
// -> Karachi — 30 to 60 minutes off).
for (const [name, lat, lng, tz] of [
  ['Dubai', 25.2, 55.27, 'Asia/Dubai'],
  ['Riyadh', 24.71, 46.68, 'Asia/Riyadh'],
  ['Kuala Lumpur', 3.14, 101.69, 'Asia/Kuala_Lumpur'],
  ['Singapore', 1.35, 103.82, 'Asia/Kuala_Lumpur'],
  ['Jakarta', -6.2, 106.85, 'Asia/Jakarta'],
  ['Delhi', 28.61, 77.21, 'Asia/Kolkata'],
  ['Mumbai', 19.08, 72.88, 'Asia/Kolkata'],
  ['Karachi', 24.86, 67.0, 'Asia/Karachi'],
  ['Lahore', 31.55, 74.34, 'Asia/Karachi'],
] as const) {
  test(`guessTimeZone maps ${name} to ${tz}`, () => {
    assert.equal(guessTimeZone(lat, lng), tz);
  });
}

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
