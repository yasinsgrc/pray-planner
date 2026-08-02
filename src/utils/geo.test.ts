import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistanceKm, findNearestLocation } from './geo';

test('haversineDistanceKm returns ~0 for identical coordinates', () => {
  const d = haversineDistanceKm(41.0264, 29.0152, 41.0264, 29.0152);
  assert.ok(d < 0.001);
});

test('haversineDistanceKm matches the known Istanbul-Ankara distance within 5%', () => {
  // Üsküdar, İstanbul -> Çankaya, Ankara — real-world distance is ~350km.
  const d = haversineDistanceKm(41.0264, 29.0152, 39.9208, 32.8541);
  assert.ok(d > 330 && d < 370, `expected ~350km, got ${d}`);
});

test('findNearestLocation picks Üsküdar for a coordinate right next to it', () => {
  const nearest = findNearestLocation(41.03, 29.02);
  assert.equal(nearest.id, 'uskudar-istanbul');
});

test('findNearestLocation picks Mekke for a coordinate right next to it', () => {
  const nearest = findNearestLocation(21.42, 39.83);
  assert.equal(nearest.id, 'makkah-saudi');
});
