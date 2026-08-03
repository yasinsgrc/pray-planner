import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateQiblaBearing } from './qibla';
import { LocationItem } from '../types';

function loc(lat: number, lng: number): LocationItem {
  return {
    id: 'test',
    cityName: 'Test',
    districtName: 'Test',
    country: 'Test',
    lat,
    lng,
    timeZone: 'Europe/Istanbul',
  };
}

// Istanbul's qibla bearing is well-documented (~151-152 deg, southeast) —
// used here as a real-world sanity check, not just an internal
// self-consistency check against our own formula.
test('calculateQiblaBearing points roughly southeast from Istanbul', () => {
  const bearing = calculateQiblaBearing(loc(41.0082, 28.9784));
  assert.ok(bearing > 145 && bearing < 155, `expected ~145-155, got ${bearing}`);
});

test('calculateQiblaBearing is 0-360', () => {
  const bearing = calculateQiblaBearing(loc(41.0082, 28.9784));
  assert.ok(bearing >= 0 && bearing < 360);
});

// Directly north of the Kaaba (same longitude, higher latitude): bearing
// should point due south (180).
test('calculateQiblaBearing is due south from directly north of the Kaaba', () => {
  const bearing = calculateQiblaBearing(loc(40, 39.8262));
  assert.ok(Math.abs(bearing - 180) < 0.01, `expected ~180, got ${bearing}`);
});
