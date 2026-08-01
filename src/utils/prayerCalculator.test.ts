import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDaySchedule, deriveLiveSchedule } from './prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';

const FIXED_DAY = new Date('2026-08-01T00:00:00');

test('deriveLiveSchedule reuses one RawDaySchedule across multiple ticks without rebuilding it', () => {
  const day = calculateDaySchedule(DEFAULT_LOCATION, FIXED_DAY, 'Diyanet');

  const morningTick = new Date(day.sunrise.getTime() + 5 * 60 * 1000); // just after gunes
  const noonTick = new Date(day.dhuhr.getTime() + 5 * 60 * 1000); // just after ogle

  const morningSchedule = deriveLiveSchedule(day, morningTick);
  const noonSchedule = deriveLiveSchedule(day, noonTick);

  assert.equal(morningSchedule.activePrayer.name, 'gunes');
  assert.equal(noonSchedule.activePrayer.name, 'ogle');
  // Same underlying day data reused for both derivations (the whole point
  // of the split — no adhan recomputation between ticks).
  assert.equal(morningSchedule.prayers[0].dateObj, day.fajr);
  assert.equal(noonSchedule.prayers[0].dateObj, day.fajr);
});

test('deriveLiveSchedule marks the correct kerahet window active from day data', () => {
  const day = calculateDaySchedule(DEFAULT_LOCATION, FIXED_DAY, 'Diyanet');
  const duringSunriseKerahet = new Date(day.sunrise.getTime() + 10 * 60 * 1000);

  const schedule = deriveLiveSchedule(day, duringSunriseKerahet);

  assert.ok(schedule.currentKerahet);
  assert.equal(schedule.currentKerahet?.type, 'gunes_sonrasi');
});

test('deriveLiveSchedule before fajr rolls back to yesterday isha as the active prayer', () => {
  const day = calculateDaySchedule(DEFAULT_LOCATION, FIXED_DAY, 'Diyanet');
  const beforeFajr = new Date(day.fajr.getTime() - 60 * 60 * 1000);

  const schedule = deriveLiveSchedule(day, beforeFajr);

  assert.equal(schedule.activePrayer.name, 'yatsi');
  assert.equal(schedule.nextPrayer.name, 'imsak');
});

test('dayCycle spans today fajr-to-fajr and dayProgress tracks it once fajr has passed', () => {
  const day = calculateDaySchedule(DEFAULT_LOCATION, FIXED_DAY, 'Diyanet');
  const noonTick = new Date(day.dhuhr.getTime());

  const schedule = deriveLiveSchedule(day, noonTick);

  assert.equal(schedule.dayCycleStart.getTime(), day.fajr.getTime());
  assert.equal(schedule.dayCycleEnd.getTime(), day.tomorrowFajr.getTime());
  assert.equal(schedule.dayCyclePrayers[0].dateObj.getTime(), day.fajr.getTime());
  assert.ok(schedule.dayProgress > 0 && schedule.dayProgress < 1);
});

test('dayCycle wraps to the previous day fajr-to-fajr window before today fajr', () => {
  const day = calculateDaySchedule(DEFAULT_LOCATION, FIXED_DAY, 'Diyanet');
  const beforeFajr = new Date(day.fajr.getTime() - 60 * 60 * 1000);

  const schedule = deriveLiveSchedule(day, beforeFajr);

  assert.equal(schedule.dayCycleStart.getTime(), day.yesterdayFajr.getTime());
  assert.equal(schedule.dayCycleEnd.getTime(), day.fajr.getTime());
  assert.equal(schedule.dayCyclePrayers[0].dateObj.getTime(), day.yesterdayFajr.getTime());
  assert.ok(schedule.dayProgress > 0 && schedule.dayProgress < 1);
});

test('tomorrowImsakTime/tomorrowAksamTime match tomorrow fajr/maghrib formatted as HH:mm', () => {
  const day = calculateDaySchedule(DEFAULT_LOCATION, FIXED_DAY, 'Diyanet');
  const schedule = deriveLiveSchedule(day, day.dhuhr);

  const expectedImsak = `${day.tomorrowFajr.getHours().toString().padStart(2, '0')}:${day.tomorrowFajr
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
  const expectedAksam = `${day.tomorrowMaghrib.getHours().toString().padStart(2, '0')}:${day.tomorrowMaghrib
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  assert.equal(schedule.tomorrowImsakTime, expectedImsak);
  assert.equal(schedule.tomorrowAksamTime, expectedAksam);
});
