import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeHeadingFromOrientationEvent,
  applyScreenOrientationCompensation,
  smoothHeading,
  getAngularDifference,
  isAlignedWithBearing,
  getTurnInstruction,
  computeHeadingDrift,
} from './compassHeading';

test('computeHeadingFromOrientationEvent prefers webkitCompassHeading when present (iOS)', () => {
  const heading = computeHeadingFromOrientationEvent({ webkitCompassHeading: 123.4, alpha: 50, absolute: false });
  assert.equal(heading, 123.4);
});

test('computeHeadingFromOrientationEvent uses alpha when the event is genuinely absolute (Android)', () => {
  const heading = computeHeadingFromOrientationEvent({ alpha: 90, absolute: true });
  assert.equal(heading, 270);
});

test('computeHeadingFromOrientationEvent normalizes the Android formula into 0-360', () => {
  const heading = computeHeadingFromOrientationEvent({ alpha: 0, absolute: true });
  assert.equal(heading, 0);
});

// The actual reported bug: Android's plain `deviceorientation` alpha is
// relative to wherever the device was pointed when listening started, NOT
// true north, unless its own `absolute` flag is true (or
// `deviceorientationabsolute` fired instead). Treating it as a compass
// heading anyway silently produces a wrong-by-an-arbitrary-offset compass
// (design-refresh-v3 Faz 13, real-device report: "Kıble pusulası yanlış
// çalışıyor").
test('computeHeadingFromOrientationEvent returns null for non-absolute alpha with no iOS heading', () => {
  const heading = computeHeadingFromOrientationEvent({ alpha: 90, absolute: false });
  assert.equal(heading, null);
});

test('computeHeadingFromOrientationEvent returns null when alpha is null and no iOS heading', () => {
  const heading = computeHeadingFromOrientationEvent({ alpha: null, absolute: true });
  assert.equal(heading, null);
});

test('computeHeadingFromOrientationEvent falls through to alpha when webkitCompassHeading is NaN', () => {
  const heading = computeHeadingFromOrientationEvent({ webkitCompassHeading: NaN, alpha: 50, absolute: true });
  assert.equal(heading, 310);
});

test('applyScreenOrientationCompensation adds the screen angle', () => {
  assert.equal(applyScreenOrientationCompensation(10, 90), 100);
});

test('applyScreenOrientationCompensation wraps around 360', () => {
  assert.equal(applyScreenOrientationCompensation(350, 90), 80);
});

test('applyScreenOrientationCompensation is a no-op for a 0deg screen angle', () => {
  assert.equal(applyScreenOrientationCompensation(123, 0), 123);
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

test('smoothHeading returns the raw value unsmoothed on the first sample', () => {
  const { value, state } = smoothHeading({ sin: 0, cos: 0, initialized: false }, 90);
  assert.equal(value, 90);
  assert.equal(state.initialized, true);
});

test('smoothHeading pulls the estimate toward a new sample without jumping all the way to it', () => {
  const first = smoothHeading({ sin: 0, cos: 0, initialized: false }, 0);
  const second = smoothHeading(first.state, 90, 0.3);
  assert.ok(second.value > 0 && second.value < 90, `expected a value strictly between 0 and 90, got ${second.value}`);
});

// The whole reason to average via sin/cos instead of the raw numbers: a
// naive (a+b)/2 average of two angles either side of the 0/360 seam (e.g.
// 350 and 10) gives 180 — the exact opposite direction — instead of 0.
test('smoothHeading averages correctly across the 0/360 seam', () => {
  const first = smoothHeading({ sin: 0, cos: 0, initialized: false }, 350);
  const second = smoothHeading(first.state, 10, 0.5);
  const diff = getAngularDifference(second.value, 0);
  assert.ok(diff < 20, `expected the smoothed heading to stay near 0/360, got ${second.value}`);
});

test('getTurnInstruction reports aligned within tolerance', () => {
  const result = getTurnInstruction(100, 103);
  assert.equal(result.direction, 'aligned');
  assert.equal(result.degrees, 0);
});

test('getTurnInstruction says turn right when the target is clockwise of heading', () => {
  const result = getTurnInstruction(90, 0);
  assert.equal(result.direction, 'right');
  assert.equal(result.degrees, 90);
});

test('getTurnInstruction says turn left when the target is counter-clockwise of heading', () => {
  const result = getTurnInstruction(0, 90);
  assert.equal(result.direction, 'left');
  assert.equal(result.degrees, 90);
});

test('getTurnInstruction takes the short way around the 0/360 seam (right)', () => {
  const result = getTurnInstruction(10, 350);
  assert.equal(result.direction, 'right');
  assert.equal(result.degrees, 20);
});

test('getTurnInstruction takes the short way around the 0/360 seam (left)', () => {
  const result = getTurnInstruction(350, 10);
  assert.equal(result.direction, 'left');
  assert.equal(result.degrees, 20);
});

test('getTurnInstruction never reports more than 180 degrees', () => {
  const result = getTurnInstruction(180, 0);
  assert.ok(result.degrees <= 180);
});

// design-refresh-v3 Faz 20 madde 3 — real-device report: the compass
// heading drifts progressively over time (not a fixed offset). A fixed
// offset would point to magnetic declination; a growing one points to the
// underlying sensor fusion (or a code bug), so the debug panel needs a real
// measured number instead of a guess — this is that measurement's pure core.
test('computeHeadingDrift returns null when the buffer does not yet span the minimum window', () => {
  assert.equal(computeHeadingDrift(10, 12, 30_000, 60_000), null);
});

test('computeHeadingDrift returns 0 when the heading has not moved across the window', () => {
  assert.equal(computeHeadingDrift(45, 45, 60_000, 60_000), 0);
});

test('computeHeadingDrift returns the angular distance travelled once the window is met', () => {
  assert.equal(computeHeadingDrift(10, 25, 65_000, 60_000), 15);
});

test('computeHeadingDrift handles wrap-around near the 0/360 seam', () => {
  assert.equal(computeHeadingDrift(350, 10, 60_000, 60_000), 20);
});
