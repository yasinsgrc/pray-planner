import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDistrict,
  __getDecodedDistrictCountForTest,
  __getTotalDistrictCountForTest,
  __parseBoundariesFileForTest,
} from './districtLookup';
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

test('resolveDistrict sadece bbox eşleşen ilçeleri tembel çözer', async () => {
  const totalDistricts = await __getTotalDistrictCountForTest();

  await resolveDistrict(40.83, 29.38);

  const decoded = __getDecodedDistrictCountForTest();
  const maxExpectedDecoded = Math.ceil(totalDistricts * 0.05);

  assert.ok(
    decoded > 0,
    'en az bir ilçe (bbox eşleşeni) çözülmüş olmalı',
  );
  assert.ok(
    decoded <= maxExpectedDecoded,
    `tembel çözümleme başarısız: ${decoded}/${totalDistricts} ilçe çözülmüş (beklenen en fazla ${maxExpectedDecoded})`,
  );
});

test('sürüm 2 olmayan districtBoundaries.json açık hata fırlatır', () => {
  assert.throws(
    () => __parseBoundariesFileForTest({ version: 1, attribution: '', districts: [] }),
    /sürüm 2 bekleniyor, 1 bulundu/,
  );
});
