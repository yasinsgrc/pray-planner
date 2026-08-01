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
