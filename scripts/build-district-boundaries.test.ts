import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeRing } from './build-district-boundaries.mjs';
import { __decodeRingForTest } from '../src/utils/districtLookup';

test('varint+base64 ring kodlaması 500 rastgele noktada 4 ondalık toleransında birebir round-trip eder', () => {
  const points = Array.from({ length: 500 }, () => ({
    lat: 36 + Math.random() * 6,
    lon: 26 + Math.random() * 18,
  }));
  const expected = points.map((p): [number, number] => [
    Math.round(p.lat * 1e4) / 1e4,
    Math.round(p.lon * 1e4) / 1e4,
  ]);

  const encoded = encodeRing(points);
  assert.equal(typeof encoded, 'string');

  const decoded = __decodeRingForTest(encoded);

  assert.equal(decoded.length, points.length);
  for (let i = 0; i < points.length; i++) {
    assert.deepEqual(decoded[i], expected[i]);
  }
});
