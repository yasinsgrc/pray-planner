import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGpsDistrictLabel, LOW_ACCURACY_THRESHOLD_M } from './gpsAccuracy';

const NEAREST = { cityName: 'Kocaeli', districtName: 'Çayırova' };

test('LOW_ACCURACY_THRESHOLD_M is exported so other GPS call sites can reuse the same threshold', () => {
  assert.equal(LOW_ACCURACY_THRESHOLD_M, 1000);
});

test('good accuracy (<=1000m) keeps the matched district name as-is', () => {
  assert.equal(resolveGpsDistrictLabel(NEAREST, 20), 'Çayırova');
});

test('accuracy exactly at the 1000m threshold keeps the district name', () => {
  assert.equal(resolveGpsDistrictLabel(NEAREST, 1000), 'Çayırova');
});

test('poor accuracy (>1000m) falls back to the province with a "(yaklaşık)" marker', () => {
  assert.equal(resolveGpsDistrictLabel(NEAREST, 2500), 'Kocaeli (yaklaşık)');
});

test('the fallback never asserts a specific district name for poor accuracy', () => {
  const label = resolveGpsDistrictLabel(NEAREST, 5000);
  assert.doesNotMatch(label, /Çayırova/);
});
