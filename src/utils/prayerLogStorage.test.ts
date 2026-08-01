import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, pruneOldEntries, computeWeekCount, PrayerLog } from './prayerLogStorage';

test('dateKey formats as zero-padded YYYY-MM-DD', () => {
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(dateKey(new Date(2026, 10, 23)), '2026-11-23');
});

test('pruneOldEntries drops entries older than 30 days but keeps the boundary day', () => {
  const today = new Date(2026, 7, 31); // 2026-08-31
  const log: PrayerLog = {
    '2026-08-01': ['imsak'], // exactly 30 days before -> kept
    '2026-07-31': ['ogle'], // 31 days before -> dropped
    '2026-08-30': ['aksam'], // yesterday -> kept
  };
  const pruned = pruneOldEntries(log, today);
  assert.deepEqual(Object.keys(pruned).sort(), ['2026-08-01', '2026-08-30']);
});

test('computeWeekCount sums from this week\'s Monday through today, ignoring other weeks', () => {
  // 2026-08-31 is a Monday (confirmed against a real calendar)
  const monday = new Date(2026, 7, 31);
  const log: PrayerLog = {
    '2026-08-31': ['imsak', 'ogle'], // this week, Monday: 2
    '2026-09-01': ['ikindi'], // this week, Tuesday (the "today" below): 1
    '2026-08-24': ['imsak', 'ogle', 'ikindi', 'aksam', 'yatsi'], // last week: excluded
  };
  const tuesday = new Date(2026, 8, 1);
  assert.equal(computeWeekCount(log, tuesday), 3);
  assert.equal(computeWeekCount(log, monday), 2);
});

test('computeWeekCount never counts days after "today"', () => {
  const log: PrayerLog = {
    '2026-09-03': ['imsak', 'ogle', 'ikindi'], // Thursday this week, but after "today"
  };
  const monday = new Date(2026, 7, 31);
  assert.equal(computeWeekCount(log, monday), 0);
});
