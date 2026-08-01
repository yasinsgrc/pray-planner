import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeHeadingFromOrientationEvent,
  getAngularDifference,
  isAlignedWithBearing,
} from './compassHeading';

test('computeHeadingFromOrientationEvent prefers webkitCompassHeading when present (iOS)', () => {
  const heading = computeHeadingFromOrientationEvent({ webkitCompassHeading: 123.4, alpha: 50 });
  assert.equal(heading, 123.4);
});

test('computeHeadingFromOrientationEvent falls back to alpha-based formula (Android)', () => {
  const heading = computeHeadingFromOrientationEvent({ alpha: 90 });
  assert.equal(heading, 270);
});

test('computeHeadingFromOrientationEvent normalizes the Android formula into 0-360', () => {
  const heading = computeHeadingFromOrientationEvent({ alpha: 0 });
  assert.equal(heading, 0);
});

test('computeHeadingFromOrientationEvent returns null when alpha is null and no iOS heading', () => {
  const heading = computeHeadingFromOrientationEvent({ alpha: null });
  assert.equal(heading, null);
});

test('computeHeadingFromOrientationEvent falls through to alpha when webkitCompassHeading is NaN', () => {
  const heading = computeHeadingFromOrientationEvent({ webkitCompassHeading: NaN, alpha: 50 });
  assert.equal(heading, 310);
});

test('getAngularDifference returns 0 for identical angles', () => {
  assert.equal(getAngularDifference(90, 90), 0);
});

test('getAngularDifference returns 180 for opposite angles', () => {
  assert.equal(getAngularDifference(0, 180), 180);
});

test('getAngularDifference handles wrap-around near 0/360', () => {
  assert.equal(getAngularDifference(350, 10), 20);
});

test('isAlignedWithBearing is true within the default 5 degree tolerance', () => {
  assert.equal(isAlignedWithBearing(100, 104), true);
});

test('isAlignedWithBearing is false just outside the default tolerance', () => {
  assert.equal(isAlignedWithBearing(100, 106), false);
});

test('isAlignedWithBearing respects a custom tolerance', () => {
  assert.equal(isAlignedWithBearing(100, 108, 10), true);
});

test('isAlignedWithBearing handles wrap-around alignment near 0/360', () => {
  assert.equal(isAlignedWithBearing(358, 2, 5), true);
});
