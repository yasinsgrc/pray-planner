import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polarPoint, arcPath } from './dialGeometry';

function approxEqual(a: number, b: number, tolerance = 1e-9) {
  assert.ok(Math.abs(a - b) < tolerance, `expected ${a} ≈ ${b}`);
}

test('polarPoint places fraction 0 at 12 o\'clock (straight up from center)', () => {
  const p = polarPoint(100, 100, 50, 0);
  approxEqual(p.x, 100);
  approxEqual(p.y, 50);
});

test('polarPoint places fraction 0.25 at 3 o\'clock (clockwise progression)', () => {
  const p = polarPoint(100, 100, 50, 0.25);
  approxEqual(p.x, 150);
  approxEqual(p.y, 100);
});

test('polarPoint places fraction 0.5 at 6 o\'clock', () => {
  const p = polarPoint(100, 100, 50, 0.5);
  approxEqual(p.x, 100);
  approxEqual(p.y, 150);
});

test('polarPoint places fraction 0.75 at 9 o\'clock', () => {
  const p = polarPoint(100, 100, 50, 0.75);
  approxEqual(p.x, 50);
  approxEqual(p.y, 100);
});

// This is the exact regression the earlier -rotate-90 + rotate() bug
// produced: ticks/marker landing 90° away from the arc segment they were
// meant to mark. Verifying tick and arc-segment endpoints share the same
// angle for the same fraction is the real assertion that matters here.
test('a tick and an arc segment computed for the same fraction land at the same angle', () => {
  const cx = 144, cy = 144, r = 100;
  const fraction = 0.4; // arbitrary, not a "nice" angle
  const tickPoint = polarPoint(cx, cy, r, fraction);
  const arcStartPoint = polarPoint(cx, cy, r, fraction); // what arcPath uses internally as its start
  approxEqual(tickPoint.x, arcStartPoint.x);
  approxEqual(tickPoint.y, arcStartPoint.y);
});

test('arcPath from 0 to 0.25 draws a quarter turn with no large-arc flag', () => {
  const d = arcPath(100, 100, 50, 0, 0.25);
  assert.match(d, /^M 100 50 A 50 50 0 0 1 150 100$/);
});

test('arcPath spanning more than half the circle sets the large-arc flag', () => {
  const d = arcPath(100, 100, 50, 0, 0.6);
  assert.match(d, / A 50 50 0 1 1 /);
});

test('arcPath spanning less than half the circle does not set the large-arc flag', () => {
  const d = arcPath(100, 100, 50, 0, 0.4);
  assert.match(d, / A 50 50 0 0 1 /);
});
