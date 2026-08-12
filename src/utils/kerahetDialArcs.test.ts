import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeKerahetDialArcs } from './kerahetDialArcs';
import { calculateDaySchedule, deriveLiveSchedule } from './prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';

// Faz 25 Commit 3 — kerahet yayları çembere geri eklendi (7b9e884'te
// kaldırılmıştı; yayların "kesik" görünmesi 3 ayrı, saatlerce arayla
// pencerenin doğal sonucuydu, dasharray hatası değildi). Bu kez 5px
// kalınlık ve ≥3:1 kontrastla, aynı geometriyle.
const day = calculateDaySchedule(DEFAULT_LOCATION, new Date('2026-08-01T00:00:00'), 'Diyanet');

test('computeKerahetDialArcs positions each kerahet window as a start/end fraction of the day cycle', () => {
  const now = day.dhuhr;
  const schedule = deriveLiveSchedule(day, now);
  const totalMs = schedule.dayCycleEnd.getTime() - schedule.dayCycleStart.getTime();

  const arcs = computeKerahetDialArcs(schedule.kerahetTimes, schedule.dayCycleStart, totalMs, now);

  assert.equal(arcs.length, 3);
  for (const arc of arcs) {
    assert.ok(arc.startFrac >= 0 && arc.startFrac <= 1);
    assert.ok(arc.endFrac > arc.startFrac);
  }
});

test('computeKerahetDialArcs marks a currently-active kerahet as urgent', () => {
  const duringSunriseKerahet = new Date(day.sunrise.getTime() + 10 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringSunriseKerahet);
  const totalMs = schedule.dayCycleEnd.getTime() - schedule.dayCycleStart.getTime();

  const arcs = computeKerahetDialArcs(schedule.kerahetTimes, schedule.dayCycleStart, totalMs, duringSunriseKerahet);
  const active = arcs.find((a) => a.isActiveOrUpcoming);

  assert.ok(active, 'aktif kerahet penceresi işaretlenmedi');
});

test('computeKerahetDialArcs marks a kerahet starting within 15 minutes as urgent', () => {
  const firstKerahet = deriveLiveSchedule(day, day.dhuhr).kerahetTimes[0];
  const tenMinBefore = new Date(firstKerahet.startTime.getTime() - 10 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, tenMinBefore);
  const totalMs = schedule.dayCycleEnd.getTime() - schedule.dayCycleStart.getTime();

  const arcs = computeKerahetDialArcs(schedule.kerahetTimes, schedule.dayCycleStart, totalMs, tenMinBefore);
  const upcoming = arcs.find((a) => a.type === firstKerahet.type);

  assert.ok(upcoming?.isActiveOrUpcoming);
});

test('computeKerahetDialArcs filters out windows entirely outside the current day cycle', () => {
  const now = day.dhuhr;
  const schedule = deriveLiveSchedule(day, now);
  const totalMs = schedule.dayCycleEnd.getTime() - schedule.dayCycleStart.getTime();
  const outOfRange = [
    {
      ...schedule.kerahetTimes[0],
      startTime: new Date(schedule.dayCycleStart.getTime() - 10 * 24 * 60 * 60 * 1000),
      endTime: new Date(schedule.dayCycleStart.getTime() - 9 * 24 * 60 * 60 * 1000),
    },
  ];

  const arcs = computeKerahetDialArcs(outOfRange, schedule.dayCycleStart, totalMs, now);

  assert.equal(arcs.length, 0);
});
