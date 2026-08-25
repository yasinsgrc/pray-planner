import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDistrict } from './districtLookup';
import { findNearestLocation } from './geo';

test('Emek Mah. Darıca koordinatı Darıca olarak çözümlenir', async () => {
  const result = await resolveDistrict(40.796769, 29.36696);
  assert.deepEqual(result, { il: 'Kocaeli', ilce: 'Darıca' });
});

test('regresyon: nearest-centroid bu koordinatta yanılır, PiP yanılmaz', async () => {
  assert.equal(findNearestLocation(40.796769, 29.36696).id, 'kocaeli-cayirova');
  const result = await resolveDistrict(40.796769, 29.36696);
  assert.equal(result?.ilce, 'Darıca');
});

test('Çayırova iç koordinatı Çayırova olarak çözümlenir', async () => {
  const result = await resolveDistrict(40.83, 29.38);
  assert.deepEqual(result, { il: 'Kocaeli', ilce: 'Çayırova' });
});

test('Türkiye dışı koordinat null döner', async () => {
  const result = await resolveDistrict(48.8566, 2.3522);
  assert.equal(result, null);
});

test('denizdeki koordinat null döner', async () => {
  const result = await resolveDistrict(40.65, 28.7);
  assert.equal(result, null);
});
