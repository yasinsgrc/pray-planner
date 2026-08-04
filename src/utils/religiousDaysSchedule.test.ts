import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNextReligiousDay, getUpcomingReligiousDays, getRamadanInfo } from './religiousDaysSchedule';
import { ReligiousDayEntry } from '../data/religiousDays';

const ENTRIES: ReligiousDayEntry[] = [
  { name: 'A', date: '2026-01-15' },
  { name: 'B', date: '2026-02-02' },
  { name: 'C', date: '2026-02-19' },
];

const RAMADAN_ENTRIES: ReligiousDayEntry[] = [
  { name: 'Ramazan Başlangıcı', date: '2026-02-19' },
  { name: 'Kadir Gecesi', date: '2026-03-16' },
  { name: 'Ramazan Bayramı Arefesi', date: '2026-03-19' },
  { name: 'Ramazan Bayramı (1. Gün)', date: '2026-03-20' },
];

test('getNextReligiousDay returns the nearest future entry with correct daysRemaining', () => {
  const result = getNextReligiousDay(new Date('2026-01-10T12:00:00Z'), undefined, ENTRIES);
  assert.ok(result);
  assert.equal(result?.entry.name, 'A');
  assert.equal(result?.daysRemaining, 5);
});

test('getNextReligiousDay returns daysRemaining 0 when today matches an entry exactly', () => {
  const result = getNextReligiousDay(new Date('2026-01-15T09:00:00Z'), undefined, ENTRIES);
  assert.ok(result);
  assert.equal(result?.entry.name, 'A');
  assert.equal(result?.daysRemaining, 0);
});

test('getNextReligiousDay skips past entries and finds the next one', () => {
  const result = getNextReligiousDay(new Date('2026-01-20T12:00:00Z'), undefined, ENTRIES);
  assert.ok(result);
  assert.equal(result?.entry.name, 'B');
  assert.equal(result?.daysRemaining, 13);
});

test('getNextReligiousDay returns null when every entry is in the past (calendar exhausted)', () => {
  const result = getNextReligiousDay(new Date('2026-03-01T12:00:00Z'), undefined, ENTRIES);
  assert.equal(result, null);
});

test('getUpcomingReligiousDays returns only today-or-future entries in chronological order with daysRemaining', () => {
  const result = getUpcomingReligiousDays(new Date('2026-01-20T12:00:00Z'), undefined, ENTRIES);
  assert.deepEqual(
    result.map((r) => r.name),
    ['B', 'C']
  );
  assert.equal(result[0].daysRemaining, 13);
  assert.equal(result[1].daysRemaining, 30);
});

test('getUpcomingReligiousDays returns an empty array when the calendar is exhausted', () => {
  const result = getUpcomingReligiousDays(new Date('2026-03-01T12:00:00Z'), undefined, ENTRIES);
  assert.deepEqual(result, []);
});

test('getNextReligiousDay uses the given timeZone to determine "today", not the device zone', () => {
  // 2026-01-14T23:30:00Z is still 2026-01-14 in UTC, but already
  // 2026-01-15 08:30 in Asia/Tokyo (UTC+9) — the entry dated 2026-01-15
  // should read as "today" (daysRemaining 0) under that zone.
  const result = getNextReligiousDay(new Date('2026-01-14T23:30:00Z'), 'Asia/Tokyo', ENTRIES);
  assert.ok(result);
  assert.equal(result?.entry.name, 'A');
  assert.equal(result?.daysRemaining, 0);
});

test('getRamadanInfo returns null before Ramadan starts', () => {
  const result = getRamadanInfo(new Date('2026-02-18T12:00:00Z'), undefined, RAMADAN_ENTRIES);
  assert.equal(result, null);
});

test('getRamadanInfo returns day 1 on the first day of Ramadan', () => {
  const result = getRamadanInfo(new Date('2026-02-19T12:00:00Z'), undefined, RAMADAN_ENTRIES);
  assert.ok(result);
  assert.equal(result?.dayNumber, 1);
  assert.equal(result?.totalDays, 29);
});

test('getRamadanInfo returns the correct day number mid-Ramadan', () => {
  const result = getRamadanInfo(new Date('2026-03-01T12:00:00Z'), undefined, RAMADAN_ENTRIES);
  assert.ok(result);
  assert.equal(result?.dayNumber, 11);
  assert.equal(result?.totalDays, 29);
});

test('getRamadanInfo still returns a result on the last day (Ramazan Bayramı Arefesi)', () => {
  const result = getRamadanInfo(new Date('2026-03-19T12:00:00Z'), undefined, RAMADAN_ENTRIES);
  assert.ok(result);
  assert.equal(result?.dayNumber, 29);
  assert.equal(result?.totalDays, 29);
});

test('getRamadanInfo returns null once Ramazan Bayramı starts', () => {
  const result = getRamadanInfo(new Date('2026-03-20T12:00:00Z'), undefined, RAMADAN_ENTRIES);
  assert.equal(result, null);
});

test('getRamadanInfo returns null when the data set has no Ramadan range at all', () => {
  const result = getRamadanInfo(new Date('2026-02-19T12:00:00Z'), undefined, ENTRIES);
  assert.equal(result, null);
});

test('getRamadanInfo works against the real RELIGIOUS_DAYS data set for 2026 Ramadan', async () => {
  const result = getRamadanInfo(new Date('2026-02-19T12:00:00Z'));
  assert.ok(result);
  assert.equal(result?.dayNumber, 1);
});

test('the real RELIGIOUS_DAYS data set is non-empty, chronologically sorted, and every date is well-formed', async () => {
  const { RELIGIOUS_DAYS } = await import('../data/religiousDays');
  assert.ok(RELIGIOUS_DAYS.length > 0);
  const dates = RELIGIOUS_DAYS.map((e) => e.date);
  for (const d of dates) {
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/, `malformed date: ${d}`);
  }
  const sorted = [...dates].sort();
  assert.deepEqual(dates, sorted, 'RELIGIOUS_DAYS must already be in chronological order');
});
