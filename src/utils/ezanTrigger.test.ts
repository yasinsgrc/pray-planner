import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldPlayEzanOnTransition } from './ezanTrigger';

const ISHA = Date.parse('2026-08-10T17:30:00Z');

test('plays when the active prayer just changed at its own start time', () => {
  assert.equal(
    shouldPlayEzanOnTransition({ previousName: 'aksam', activeName: 'yatsi', activeStartMs: ISHA, nowMs: ISHA + 1000 }),
    true
  );
});

test('does not play on the first render (no previous prayer yet)', () => {
  assert.equal(
    shouldPlayEzanOnTransition({ previousName: null, activeName: 'yatsi', activeStartMs: ISHA, nowMs: ISHA + 1000 }),
    false
  );
});

test('does not play when the active prayer did not change', () => {
  assert.equal(
    shouldPlayEzanOnTransition({ previousName: 'yatsi', activeName: 'yatsi', activeStartMs: ISHA, nowMs: ISHA + 1000 }),
    false
  );
});

test('does not play when a location change switches to a prayer that began long ago', () => {
  assert.equal(
    shouldPlayEzanOnTransition({
      previousName: 'aksam',
      activeName: 'yatsi',
      activeStartMs: ISHA,
      nowMs: ISHA + 2 * 60 * 60 * 1000,
    }),
    false
  );
});

test('does not play hours late after the app returns from the background', () => {
  assert.equal(
    shouldPlayEzanOnTransition({
      previousName: 'ikindi',
      activeName: 'yatsi',
      activeStartMs: ISHA,
      nowMs: ISHA + 3 * 60 * 60 * 1000,
    }),
    false
  );
});

test('still plays when a throttled background timer notices the change a minute late', () => {
  assert.equal(
    shouldPlayEzanOnTransition({ previousName: 'aksam', activeName: 'yatsi', activeStartMs: ISHA, nowMs: ISHA + 70_000 }),
    true
  );
});

test('does not play for a prayer whose start is still ahead (pre-fajr Yatsı carry-over)', () => {
  assert.equal(
    shouldPlayEzanOnTransition({ previousName: 'imsak', activeName: 'yatsi', activeStartMs: ISHA, nowMs: ISHA - 60_000 }),
    false
  );
});
