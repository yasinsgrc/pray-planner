import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlySchedule, clearMonthlyScheduleCache } from './monthlySchedule';
import { LocationItem } from '../types';

const ISTANBUL: LocationItem = {
  id: 'uskudar-istanbul',
  cityName: 'İstanbul',
  districtName: 'Üsküdar',
  country: 'Türkiye',
  lat: 41.0264,
  lng: 29.0152,
  timeZone: 'Europe/Istanbul',
};

const MECCA: LocationItem = {
  id: 'makkah-saudi',
  cityName: 'Mekke',
  districtName: '',
  country: 'Suudi Arabistan',
  lat: 21.4225,
  lng: 39.8262,
  timeZone: 'Asia/Riyadh',
};

test('buildMonthlySchedule returns one row per day in the month (31 days for August)', () => {
  const schedule = buildMonthlySchedule(ISTANBUL, 'Diyanet', 2026, 8);
  assert.equal(schedule.days.length, 31);
});

test('buildMonthlySchedule returns the correct day count for February in a non-leap year', () => {
  const schedule = buildMonthlySchedule(ISTANBUL, 'Diyanet', 2026, 2);
  assert.equal(schedule.days.length, 28);
});

test('buildMonthlySchedule returns the correct day count for February in a leap year', () => {
  const schedule = buildMonthlySchedule(ISTANBUL, 'Diyanet', 2028, 2);
  assert.equal(schedule.days.length, 29);
});

test('buildMonthlySchedule gives each day all 6 prayers with a non-empty time string', () => {
  const schedule = buildMonthlySchedule(ISTANBUL, 'Diyanet', 2026, 8);
  for (const day of schedule.days) {
    assert.equal(day.prayers.length, 6);
    for (const p of day.prayers) {
      assert.match(p.timeString, /^\d{2}:\d{2}$/);
    }
  }
});

test('buildMonthlySchedule gives each day a hijri date', () => {
  const schedule = buildMonthlySchedule(ISTANBUL, 'Diyanet', 2026, 8);
  for (const day of schedule.days) {
    assert.ok(day.hijri.formatted.length > 0);
  }
});

test('buildMonthlySchedule dateKey is a distinct, chronologically ordered YYYY-MM-DD per day', () => {
  const schedule = buildMonthlySchedule(ISTANBUL, 'Diyanet', 2026, 8);
  const keys = schedule.days.map((d) => d.dateKey);
  assert.equal(keys[0], '2026-08-01');
  assert.equal(keys[30], '2026-08-31');
  assert.equal(new Set(keys).size, keys.length, 'every dateKey must be unique');
  const sorted = [...keys].sort();
  assert.deepEqual(keys, sorted, 'dateKeys must already be in chronological order');
});

test('buildMonthlySchedule memoizes: same location/method/year/month returns the identical object', () => {
  clearMonthlyScheduleCache();
  const first = buildMonthlySchedule(ISTANBUL, 'Diyanet', 2026, 8);
  const second = buildMonthlySchedule(ISTANBUL, 'Diyanet', 2026, 8);
  assert.equal(first, second, 'expected the cached object to be returned, not recomputed');
});

test('buildMonthlySchedule does not share cache entries across different locations', () => {
  clearMonthlyScheduleCache();
  const istanbul = buildMonthlySchedule(ISTANBUL, 'Diyanet', 2026, 8);
  const mecca = buildMonthlySchedule(MECCA, 'Diyanet', 2026, 8);
  assert.notEqual(istanbul, mecca);
  assert.notEqual(istanbul.days[0].prayers[0].timeString, mecca.days[0].prayers[0].timeString);
});

test('buildMonthlySchedule does not share cache entries across different months', () => {
  clearMonthlyScheduleCache();
  const august = buildMonthlySchedule(ISTANBUL, 'Diyanet', 2026, 8);
  const september = buildMonthlySchedule(ISTANBUL, 'Diyanet', 2026, 9);
  assert.notEqual(august, september);
  assert.equal(august.days.length, 31);
  assert.equal(september.days.length, 30);
});
