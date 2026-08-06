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
  computeHeadingStats,
  classifyDriftCharacter,
  summarizePlatform,
  determineActiveEventType,
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

// design-refresh-v3 Faz 21 madde 2 — the debug panel needs to distinguish
// a fixed offset (could be declination) from a growing one (sensor
// fusion / code bug), and neither guess-based reasoning nor eyeballing a
// single number tells you that; these stats do.
test('computeHeadingStats returns null for an empty buffer', () => {
  assert.equal(computeHeadingStats([]), null);
});

test('computeHeadingStats reports a single sample as its own min/max/average with zero spread', () => {
  const stats = computeHeadingStats([42]);
  assert.deepEqual(stats, { min: 42, max: 42, average: 42, spread: 0 });
});

test('computeHeadingStats computes plain min/max/spread when nothing wraps', () => {
  const stats = computeHeadingStats([10, 20, 30]);
  assert.equal(stats?.min, 10);
  assert.equal(stats?.max, 30);
  assert.equal(stats?.spread, 20);
  assert.equal(stats?.average, 20);
});

// The whole reason `spread` exists alongside raw min/max: naive min/max
// (2 and 358) would claim a 356 degree spread for values that are all
// within ~14 degrees of each other physically, once you cross the 0/360
// seam. `spread` (max pairwise angular difference, circular-safe) must
// report the true ~14, even though raw min/max still show 2 and 358.
test('computeHeadingStats spread stays small across the 0/360 seam even though raw min/max look huge', () => {
  const stats = computeHeadingStats([350, 352, 358, 2, 4]);
  assert.equal(stats?.min, 2);
  assert.equal(stats?.max, 358);
  assert.ok(stats!.spread <= 15, `expected a small circular spread, got ${stats?.spread}`);
});

test('classifyDriftCharacter reports insufficient-data with fewer than 3 samples', () => {
  assert.equal(classifyDriftCharacter([10]), 'insufficient-data');
  assert.equal(classifyDriftCharacter([10, 12]), 'insufficient-data');
});

test('classifyDriftCharacter reports stable when the heading barely moves', () => {
  assert.equal(classifyDriftCharacter([10, 10.1, 9.9, 10, 10.2]), 'stable');
});

test('classifyDriftCharacter reports monotonic for a one-directional trend', () => {
  assert.equal(classifyDriftCharacter([10, 15, 20, 25, 30]), 'monotonic');
});

test('classifyDriftCharacter reports monotonic across the 0/360 seam (not fooled by the wrap)', () => {
  assert.equal(classifyDriftCharacter([355, 358, 1, 4, 7]), 'monotonic');
});

test('classifyDriftCharacter reports oscillating for a back-and-forth pattern', () => {
  assert.equal(classifyDriftCharacter([10, 25, 10, 25, 10, 25]), 'oscillating');
});

test('summarizePlatform extracts a short platform + browser label from an Android Chrome UA', () => {
  const ua =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  const summary = summarizePlatform(ua);
  assert.match(summary, /Linux; Android 14/);
  assert.match(summary, /Chrome\/120\.0\.0\.0/);
});

test('summarizePlatform extracts a short platform + browser label from an iOS Safari UA', () => {
  const ua =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/604.1';
  const summary = summarizePlatform(ua);
  assert.match(summary, /iPhone; CPU iPhone OS 17_4 like Mac OS X/);
});

test('summarizePlatform falls back gracefully on an unrecognized string', () => {
  assert.equal(summarizePlatform(''), 'bilinmiyor · bilinmiyor');
});

// design-refresh-v3 Faz 21 madde 2 — "hangi API'nin aktif olduğu" must be
// SET directly by whichever handler actually fired, never inferred after
// the fact from unrelated state; this is that decision, extracted so the
// debug panel's most important field is unit-tested like everything else
// feeding it (this project has no jsdom/React test renderer, so the hook
// itself — which needs real DOM events — stays untested by design; this
// function carries 100% of its non-trivial logic out to where it can be).
test('determineActiveEventType prefers webkitCompassHeading whenever it is present, regardless of source', () => {
  assert.equal(determineActiveEventType(123.4, 'deviceorientation'), 'webkitCompassHeading');
  assert.equal(determineActiveEventType(0, 'deviceorientationabsolute'), 'webkitCompassHeading');
});

test('determineActiveEventType falls back to the event source name when there is no webkitCompassHeading', () => {
  assert.equal(determineActiveEventType(undefined, 'deviceorientationabsolute'), 'deviceorientationabsolute');
  assert.equal(determineActiveEventType(undefined, 'deviceorientation'), 'deviceorientation');
});

test('determineActiveEventType treats NaN webkitCompassHeading as absent', () => {
  assert.equal(determineActiveEventType(NaN, 'deviceorientationabsolute'), 'deviceorientationabsolute');
});
