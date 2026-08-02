import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getHijriDate } from './hijri';

test('converts a known Gregorian date to the correct Hijri new year', () => {
  const result = getHijriDate(new Date(2025, 5, 26));
  assert.equal(result.day, 1);
  assert.equal(result.monthName, 'Muharrem');
  assert.equal(result.year, 1447);
  assert.equal(result.formatted, '1 Muharrem 1447');
});

test('converts another known date correctly', () => {
  const result = getHijriDate(new Date(2026, 7, 1));
  assert.equal(result.day, 18);
  assert.equal(result.monthName, 'Safer');
  assert.equal(result.year, 1448);
});

test('uses the given time zone\'s calendar day, not the device\'s', () => {
  // 2026-08-01 23:30 UTC is already 2026-08-02 in Asia/Riyadh (UTC+3) —
  // the Hijri day should follow Riyadh's date, one day ahead of plain UTC.
  const instant = new Date(Date.UTC(2026, 7, 1, 23, 30));
  const utcResult = getHijriDate(instant, 'UTC');
  const riyadhResult = getHijriDate(instant, 'Asia/Riyadh');
  assert.notEqual(utcResult.day, riyadhResult.day);
});
