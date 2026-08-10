import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSuggestLocationChange, isLocationDriftCheckAllowed } from './locationDrift';

const BASE = { lat: 40.77, lng: 29.37, label: 'Darıca' };

/** North-south offset (same longitude): for Δlng=0, the haversine formula's
 * central angle reduces exactly to |Δlat_rad|, so distance = R * Δlat_rad
 * is exact (not an approximation) — R=6371 matches haversineDistanceKm's
 * own constant, so this hits the boundary tests precisely. */
const EARTH_RADIUS_KM = 6371;
function northOf(km: number) {
  const dLatDeg = (km / EARTH_RADIUS_KM) * (180 / Math.PI);
  return { lat: BASE.lat + dLatDeg, lng: BASE.lng };
}

const NOW = new Date('2026-08-10T12:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;

test('permission gate: not granted means the check is never allowed', () => {
  assert.equal(isLocationDriftCheckAllowed('denied'), false);
  assert.equal(isLocationDriftCheckAllowed('prompt'), false);
  assert.equal(isLocationDriftCheckAllowed('unsupported'), false);
});

test('permission gate: granted allows the check', () => {
  assert.equal(isLocationDriftCheckAllowed('granted'), true);
});

test('low accuracy (>1000m) never suggests, regardless of distance', () => {
  const result = shouldSuggestLocationChange({
    current: { ...BASE, source: 'gps' },
    detected: { ...northOf(50), label: 'Uzak', accuracy: 2500 },
    dismissed: null,
    now: NOW,
  });
  assert.equal(result, false);
});

test('manual source, 10km drift: below the 50km threshold, no suggestion', () => {
  const result = shouldSuggestLocationChange({
    current: { ...BASE, source: 'manual' },
    detected: { ...northOf(10), label: BASE.label, accuracy: 20 },
    dismissed: null,
    now: NOW,
  });
  assert.equal(result, false);
});

test('manual source, 60km drift: above the 50km threshold, suggests', () => {
  const result = shouldSuggestLocationChange({
    current: { ...BASE, source: 'manual' },
    detected: { ...northOf(60), label: 'Farklı Şehir', accuracy: 20 },
    dismissed: null,
    now: NOW,
  });
  assert.equal(result, true);
});

test('gps source, 3km drift, same label: below the 5km threshold, no suggestion', () => {
  const result = shouldSuggestLocationChange({
    current: { ...BASE, source: 'gps' },
    detected: { ...northOf(3), label: BASE.label, accuracy: 20 },
    dismissed: null,
    now: NOW,
  });
  assert.equal(result, false);
});

test('gps source, 7km drift: above the 5km threshold, suggests', () => {
  const result = shouldSuggestLocationChange({
    current: { ...BASE, source: 'gps' },
    detected: { ...northOf(7), label: 'Farklı İlçe', accuracy: 20 },
    dismissed: null,
    now: NOW,
  });
  assert.equal(result, true);
});

test('gps source, same coordinates but a different resolved label: suggests', () => {
  const result = shouldSuggestLocationChange({
    current: { ...BASE, source: 'gps' },
    detected: { lat: BASE.lat, lng: BASE.lng, label: 'Çayırova', accuracy: 20 },
    dismissed: null,
    now: NOW,
  });
  assert.equal(result, true);
});

test('dismissed 2 hours ago near the same spot: suppressed (within 24h cooldown)', () => {
  const detected = { ...northOf(7), label: 'Farklı İlçe', accuracy: 20 };
  const result = shouldSuggestLocationChange({
    current: { ...BASE, source: 'gps' },
    detected,
    dismissed: { lat: detected.lat, lng: detected.lng, ts: NOW - 2 * HOUR },
    now: NOW,
  });
  assert.equal(result, false);
});

test('dismissed 30 hours ago near the same spot: cooldown expired, suggests again', () => {
  const detected = { ...northOf(7), label: 'Farklı İlçe', accuracy: 20 };
  const result = shouldSuggestLocationChange({
    current: { ...BASE, source: 'gps' },
    detected,
    dismissed: { lat: detected.lat, lng: detected.lng, ts: NOW - 30 * HOUR },
    now: NOW,
  });
  assert.equal(result, true);
});

test('boundary: gps distance just under 5km does not suggest, just over does', () => {
  const under = shouldSuggestLocationChange({
    current: { ...BASE, source: 'gps' },
    detected: { ...northOf(4.99), label: BASE.label, accuracy: 20 },
    dismissed: null,
    now: NOW,
  });
  const over = shouldSuggestLocationChange({
    current: { ...BASE, source: 'gps' },
    detected: { ...northOf(5.01), label: BASE.label, accuracy: 20 },
    dismissed: null,
    now: NOW,
  });
  assert.equal(under, false);
  assert.equal(over, true);
});

test('boundary: manual distance just under 50km does not suggest, just over does', () => {
  const under = shouldSuggestLocationChange({
    current: { ...BASE, source: 'manual' },
    detected: { ...northOf(49.99), label: 'X', accuracy: 20 },
    dismissed: null,
    now: NOW,
  });
  const over = shouldSuggestLocationChange({
    current: { ...BASE, source: 'manual' },
    detected: { ...northOf(50.01), label: 'X', accuracy: 20 },
    dismissed: null,
    now: NOW,
  });
  assert.equal(under, false);
  assert.equal(over, true);
});

test('dismissed record far from the newly detected point does not suppress an otherwise-valid suggestion', () => {
  const farDismissed = northOf(200);
  const result = shouldSuggestLocationChange({
    current: { ...BASE, source: 'gps' },
    detected: { ...northOf(7), label: 'Farklı İlçe', accuracy: 20 },
    dismissed: { lat: farDismissed.lat, lng: farDismissed.lng, ts: NOW - 1 * HOUR },
    now: NOW,
  });
  assert.equal(result, true);
});
