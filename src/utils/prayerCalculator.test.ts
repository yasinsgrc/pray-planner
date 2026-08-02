import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDaySchedule, deriveLiveSchedule } from './prayerCalculator';
import { getCalendarDateInZone } from './timezone';
import { formatTime } from './formatTime';
import { DEFAULT_LOCATION } from '../data/locations';
import { LocationItem } from '../types';

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

  // Must go through the same resolvedTimeZone as the code under test, not
  // Date's device-local getHours/getMinutes — the previous version of this
  // test read the expected value in the device's zone while the app (since
  // design-refresh-v3 Faz 4) formats it in the *location's* zone, so this
  // passed only on a machine whose TZ happened to match DEFAULT_LOCATION
  // (Europe/Istanbul) and failed under TZ=UTC (e.g. most CI).
  const expectedImsak = formatTime(day.tomorrowFajr, schedule.resolvedTimeZone);
  const expectedAksam = formatTime(day.tomorrowMaghrib, schedule.resolvedTimeZone);

  assert.equal(schedule.tomorrowImsakTime, expectedImsak);
  assert.equal(schedule.tomorrowAksamTime, expectedAksam);
});

test('adhan receives the location calendar day, not the device calendar day, across a day-boundary mismatch', () => {
  // Europe/Istanbul and Asia/Riyadh (the user's original scenario) are both
  // fixed at UTC+3 with no DST, so those two zones can never actually be on
  // different calendar days at the same instant — a real day-boundary
  // mismatch needs zones that differ enough in offset. Asia/Tokyo (UTC+9,
  // also fixed, no DST) as the device zone against Asia/Riyadh (UTC+3,
  // Mecca's zone) as the location reproduces the same bug: a 6-hour gap is
  // enough to put the two zones on different calendar days right around
  // midnight in the zone that's further ahead.
  const originalTZ = process.env.TZ;
  process.env.TZ = 'Asia/Tokyo';
  try {
    // Tokyo local time is 2026-08-03 00:30 at this instant, but Riyadh is
    // still 2026-08-02 18:30 (UTC+9 vs UTC+3). Reading the device's own
    // Y/M/D (the pre-fix bug) would hand adhan Aug 3 instead of the
    // location's real Aug 2.
    const instant = new Date('2026-08-03T00:30:00+09:00');
    const meccaLocation: LocationItem = {
      id: 'mecca-test',
      cityName: 'Mekke',
      districtName: 'Mekke',
      country: 'Suudi Arabistan',
      lat: 21.3891,
      lng: 39.8579,
      timeZone: 'Asia/Riyadh',
    };

    const day = calculateDaySchedule(meccaLocation, instant, 'Diyanet');

    const fajrCalendarDay = getCalendarDateInZone(day.fajr, 'Asia/Riyadh');
    assert.deepEqual(fajrCalendarDay, { year: 2026, month: 8, day: 2 });
  } finally {
    process.env.TZ = originalTZ;
  }
});
