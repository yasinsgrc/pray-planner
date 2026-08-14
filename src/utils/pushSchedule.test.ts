import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPushSchedule } from './pushSchedule';
import { LocationItem, NotificationSettings } from '../types';

const ISTANBUL: LocationItem = {
  id: 'uskudar-istanbul',
  cityName: 'İstanbul',
  districtName: 'Üsküdar',
  country: 'Türkiye',
  lat: 41.0264,
  lng: 29.0152,
  timeZone: 'Europe/Istanbul',
};

function notifications(overrides: Partial<NotificationSettings> = {}): NotificationSettings {
  return {
    imsak: 'bildirim',
    gunes: 'sessiz',
    ogle: 'bildirim',
    ikindi: 'bildirim',
    aksam: 'bildirim',
    yatsi: 'bildirim',
    earlyWarningMinutes: 15,
    earlyWarningSound: 'bildirim',
    ...overrides,
  };
}

// A fixed instant early enough (03:00 Istanbul time, well before İmsak in
// January) that every prayer for "today" onward is still in the future —
// keeps the count assertions below deterministic instead of depending on
// what time the test happens to run.
const NOW = new Date('2026-01-15T00:00:01.000Z');

test('buildPushSchedule excludes prayers set to sessiz', () => {
  const schedule = buildPushSchedule(ISTANBUL, 'Diyanet', notifications(), NOW);
  assert.ok(schedule.length > 0);
  assert.ok(!schedule.some((e) => e.prayerKey === 'gunes'), 'güneş is sessiz by default, must not appear');
});

test('buildPushSchedule includes every non-sessiz prayer at least once', () => {
  const schedule = buildPushSchedule(ISTANBUL, 'Diyanet', notifications(), NOW);
  for (const name of ['imsak', 'ogle', 'ikindi', 'aksam', 'yatsi']) {
    assert.ok(schedule.some((e) => e.prayerKey === name), `expected at least one "${name}" entry`);
  }
});

test('buildPushSchedule omits early-warning entries when earlyWarningMinutes is 0', () => {
  const schedule = buildPushSchedule(ISTANBUL, 'Diyanet', notifications({ earlyWarningMinutes: 0 }), NOW);
  assert.ok(!schedule.some((e) => e.prayerKey.includes('-early:')));
});

test('buildPushSchedule omits early-warning entries when earlyWarningSound is sessiz', () => {
  const schedule = buildPushSchedule(ISTANBUL, 'Diyanet', notifications({ earlyWarningSound: 'sessiz' }), NOW);
  assert.ok(!schedule.some((e) => e.prayerKey.includes('-early:')));
});

test('buildPushSchedule includes early-warning entries with the minutes embedded', () => {
  const schedule = buildPushSchedule(ISTANBUL, 'Diyanet', notifications({ earlyWarningMinutes: 20 }), NOW);
  assert.ok(schedule.some((e) => e.prayerKey === 'ogle-early:20'));
});

test('buildPushSchedule never returns an entry at or before "now"', () => {
  const schedule = buildPushSchedule(ISTANBUL, 'Diyanet', notifications(), NOW);
  for (const entry of schedule) {
    assert.ok(new Date(entry.fireAt).getTime() > NOW.getTime(), `${entry.prayerKey} at ${entry.fireAt} is not in the future`);
  }
});

test('buildPushSchedule produces parseable ISO timestamps', () => {
  const schedule = buildPushSchedule(ISTANBUL, 'Diyanet', notifications(), NOW);
  for (const entry of schedule) {
    assert.ok(!Number.isNaN(new Date(entry.fireAt).getTime()));
  }
});

test('buildPushSchedule stays within the 30-day x 6-prayer x 2 upper bound', () => {
  const schedule = buildPushSchedule(ISTANBUL, 'Diyanet', notifications(), NOW);
  assert.ok(schedule.length <= 30 * 6 * 2);
});

test('buildPushSchedule tags Öğle as "ogle-cuma" when its local calendar day (Europe/Istanbul) is a Friday', () => {
  // 2026-08-14 is a Friday in Europe/Istanbul (see timezone.test.ts).
  const fridayMorning = new Date('2026-08-14T03:00:00.000Z');
  const schedule = buildPushSchedule(ISTANBUL, 'Diyanet', notifications(), fridayMorning);
  const ogleEntries = schedule.filter((e) => e.prayerKey === 'ogle' || e.prayerKey === 'ogle-cuma');
  const firstOgle = ogleEntries.sort((a, b) => a.fireAt.localeCompare(b.fireAt))[0];
  assert.equal(firstOgle.prayerKey, 'ogle-cuma');
});

test('buildPushSchedule keeps "ogle" untagged when its local calendar day (Europe/Istanbul) is a Thursday', () => {
  // 2026-08-13 is a Thursday in Europe/Istanbul (see timezone.test.ts).
  const thursdayMorning = new Date('2026-08-13T03:00:00.000Z');
  const schedule = buildPushSchedule(ISTANBUL, 'Diyanet', notifications(), thursdayMorning);
  const ogleEntries = schedule.filter((e) => e.prayerKey === 'ogle' || e.prayerKey === 'ogle-cuma');
  const firstOgle = ogleEntries.sort((a, b) => a.fireAt.localeCompare(b.fireAt))[0];
  assert.equal(firstOgle.prayerKey, 'ogle');
});

test('buildPushSchedule excludes prayer times already in the past for "today"', () => {
  // A `now` set to late in the day — most of today's prayers must already
  // have passed and be excluded, while tomorrow's are still included.
  const lateInDay = new Date('2026-01-15T18:00:00.000Z'); // 21:00 Istanbul time
  const schedule = buildPushSchedule(ISTANBUL, 'Diyanet', notifications(), lateInDay);
  const todayImsak = schedule.find((e) => e.prayerKey === 'imsak' && e.fireAt.startsWith('2026-01-15'));
  assert.equal(todayImsak, undefined, "today's İmsak (early morning) must not appear — it's already past");
  const tomorrowImsak = schedule.some((e) => e.prayerKey === 'imsak' && e.fireAt.startsWith('2026-01-16'));
  assert.ok(tomorrowImsak, "tomorrow's İmsak must still be scheduled");
});
