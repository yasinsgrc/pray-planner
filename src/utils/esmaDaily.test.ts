import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayOfYear, esmaIndexFor } from './esmaDaily';

test('dayOfYear: 1 Ocak -> 1', () => {
  assert.equal(dayOfYear(new Date(2026, 0, 1)), 1);
});

test('dayOfYear: 31 Aralik normal yilda -> 365', () => {
  // 2026 is not a leap year (not divisible by 4).
  assert.equal(dayOfYear(new Date(2026, 11, 31)), 365);
});

test('dayOfYear: 31 Aralik artik yilda -> 366', () => {
  assert.equal(dayOfYear(new Date(2024, 11, 31)), 366);
});

test('dayOfYear: 29 Subat artik yilda -> 60', () => {
  assert.equal(dayOfYear(new Date(2024, 1, 29)), 60);
});

test('dayOfYear: yaz saati gecis gunu ogle ve 00:30 ayni indeksi verir', () => {
  const noon = new Date(2026, 2, 29, 12, 0, 0);
  const justAfterMidnight = new Date(2026, 2, 29, 0, 30, 0);
  assert.equal(dayOfYear(noon), dayOfYear(justAfterMidnight));
});

test('esmaIndexFor: count 24 ile sarma', () => {
  assert.equal(esmaIndexFor(new Date(2026, 0, 1), 24), 1 % 24);
  assert.equal(esmaIndexFor(new Date(2026, 0, 25), 24), 25 % 24);
});

test('esmaIndexFor: count 0 veya negatifse 0 doner', () => {
  assert.equal(esmaIndexFor(new Date(2026, 0, 1), 0), 0);
  assert.equal(esmaIndexFor(new Date(2026, 0, 1), -5), 0);
});
