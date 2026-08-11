import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeKerahetDialArcs } from './kerahetDialArcs';
import { KerahetInfo } from '../types';

const DAY_CYCLE_START = new Date('2026-08-01T04:00:00Z');
const TOTAL_MS = 24 * 60 * 60 * 1000;

function kerahet(type: KerahetInfo['type'], startOffsetMs: number, endOffsetMs: number, isActiveNow: boolean): KerahetInfo {
  return {
    type,
    title: '',
    description: '',
    startTime: new Date(DAY_CYCLE_START.getTime() + startOffsetMs),
    endTime: new Date(DAY_CYCLE_START.getTime() + endOffsetMs),
    isActiveNow,
  };
}

test('arc start/end fractions match the kerahet window\'s position within the day cycle exactly', () => {
  const HOUR = 60 * 60 * 1000;
  const times = [
    kerahet('gunes_sonrasi', 2 * HOUR, 2.75 * HOUR, false),
    kerahet('ogle_oncesi', 8.25 * HOUR, 9 * HOUR, false),
    kerahet('aksam_oncesi', 15.25 * HOUR, 16 * HOUR, false),
  ];
  const now = new Date(DAY_CYCLE_START.getTime());
  const arcs = computeKerahetDialArcs(times, DAY_CYCLE_START, TOTAL_MS, now);

  assert.equal(arcs.length, 3);
  assert.equal(arcs[0].type, 'gunes_sonrasi');
  assert.equal(arcs[0].startFrac, 2 / 24);
  assert.equal(arcs[0].endFrac, 2.75 / 24);
  assert.equal(arcs[1].type, 'ogle_oncesi');
  assert.equal(arcs[1].startFrac, 8.25 / 24);
  assert.equal(arcs[1].endFrac, 9 / 24);
  assert.equal(arcs[2].type, 'aksam_oncesi');
  assert.equal(arcs[2].startFrac, 15.25 / 24);
  assert.equal(arcs[2].endFrac, 16 / 24);
});

test('a kerahet window entirely outside the [0,1] day-cycle range is filtered out', () => {
  const beforeCycle = kerahet('gunes_sonrasi', -3 * 60 * 60 * 1000, -2 * 60 * 60 * 1000, false);
  const now = new Date(DAY_CYCLE_START.getTime());
  const arcs = computeKerahetDialArcs([beforeCycle], DAY_CYCLE_START, TOTAL_MS, now);
  assert.deepEqual(arcs, []);
});

test('the active kerahet window is marked isActiveOrUpcoming', () => {
  const HOUR = 60 * 60 * 1000;
  const active = kerahet('ogle_oncesi', 8 * HOUR, 9 * HOUR, true);
  const now = new Date(DAY_CYCLE_START.getTime() + 8.5 * HOUR);
  const arcs = computeKerahetDialArcs([active], DAY_CYCLE_START, TOTAL_MS, now);
  assert.equal(arcs[0].isActiveOrUpcoming, true);
});

test('a kerahet window starting in 10 minutes is marked isActiveOrUpcoming (within the 15 min window)', () => {
  const HOUR = 60 * 60 * 1000;
  const soon = kerahet('aksam_oncesi', 15 * HOUR, 16 * HOUR, false);
  const now = new Date(soon.startTime.getTime() - 10 * 60 * 1000);
  const arcs = computeKerahetDialArcs([soon], DAY_CYCLE_START, TOTAL_MS, now);
  assert.equal(arcs[0].isActiveOrUpcoming, true);
});

test('a kerahet window starting in 20 minutes is NOT marked isActiveOrUpcoming (outside the 15 min window)', () => {
  const HOUR = 60 * 60 * 1000;
  const later = kerahet('aksam_oncesi', 15 * HOUR, 16 * HOUR, false);
  const now = new Date(later.startTime.getTime() - 20 * 60 * 1000);
  const arcs = computeKerahetDialArcs([later], DAY_CYCLE_START, TOTAL_MS, now);
  assert.equal(arcs[0].isActiveOrUpcoming, false);
});

test('a past, inactive kerahet window is not marked isActiveOrUpcoming', () => {
  const HOUR = 60 * 60 * 1000;
  const past = kerahet('gunes_sonrasi', 2 * HOUR, 2.75 * HOUR, false);
  const now = new Date(DAY_CYCLE_START.getTime() + 10 * HOUR);
  const arcs = computeKerahetDialArcs([past], DAY_CYCLE_START, TOTAL_MS, now);
  assert.equal(arcs[0].isActiveOrUpcoming, false);
});
