import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAdjustedTime } from './prayerAdjustments';
import { PrayerAdjustments } from '../types';

const ZERO: PrayerAdjustments = { imsak: 0, gunes: 0, ogle: 0, ikindi: 0, aksam: 0, yatsi: 0 };

test('formatAdjustedTime returns the unshifted time when the adjustment is 0', () => {
  const d = new Date('2026-08-01T10:00:00Z');
  assert.equal(formatAdjustedTime(d, 'ogle', ZERO, 'UTC'), '10:00');
});

test('formatAdjustedTime shifts the displayed time forward for a positive adjustment', () => {
  const d = new Date('2026-08-01T10:00:00Z');
  const adjustments = { ...ZERO, ogle: 5 };
  assert.equal(formatAdjustedTime(d, 'ogle', adjustments, 'UTC'), '10:05');
});

test('formatAdjustedTime shifts the displayed time backward for a negative adjustment', () => {
  const d = new Date('2026-08-01T10:00:00Z');
  const adjustments = { ...ZERO, ikindi: -7 };
  assert.equal(formatAdjustedTime(d, 'ikindi', adjustments, 'UTC'), '09:53');
});

test('formatAdjustedTime only applies the adjustment for the matching prayer', () => {
  const d = new Date('2026-08-01T10:00:00Z');
  const adjustments = { ...ZERO, aksam: 10 };
  assert.equal(formatAdjustedTime(d, 'ogle', adjustments, 'UTC'), '10:00');
});
