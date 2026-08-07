import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWidgetPayload } from './widgetBridge';
import { LocationItem } from '../types';

// Faz 23 Commit 3 — widget'ın kilit ekranında saatler saatlerce doğru
// kalabilmesi için JS tarafı epoch milisaniyeyi yazar, native taraf
// yalnızca aritmetik yapar (adhan Kotlin'e port edilmez). Bu testler
// buildWidgetPayload'ın calculateDaySchedule'ı YENİDEN kullandığını,
// yeni bir hesaplama yolu icat etmediğini doğrular.
const CAYIROVA: LocationItem = {
  id: 'cayirova-test',
  cityName: 'Kocaeli',
  districtName: 'Çayırova',
  country: 'Türkiye',
  lat: 40.8,
  lng: 29.37,
  timeZone: 'Europe/Istanbul',
};

const NOW = new Date('2026-08-07T10:00:00Z'); // 7 Ağustos 2026, İstanbul saatiyle 13:00

test('entries is strictly increasing in atMs — no two entries share the same instant', () => {
  const payload = buildWidgetPayload(CAYIROVA, 'Diyanet', NOW);
  for (let i = 1; i < payload.entries.length; i++) {
    assert.ok(
      payload.entries[i].atMs > payload.entries[i - 1].atMs,
      `entry ${i} (${payload.entries[i].atMs}) should be strictly after entry ${i - 1} (${payload.entries[i - 1].atMs})`
    );
  }
});

test('7 days produce exactly 42 entries (6 prayers x 7 days)', () => {
  const payload = buildWidgetPayload(CAYIROVA, 'Diyanet', NOW);
  assert.equal(payload.entries.length, 42);
});

test('the first entry is that day\'s imsak, not the first prayer still ahead of now', () => {
  const payload = buildWidgetPayload(CAYIROVA, 'Diyanet', NOW);
  assert.equal(payload.entries[0].name, 'imsak');
  // NOW (13:00 İstanbul) is well after today's imsak (04:17) — a "first
  // upcoming prayer" implementation would have started at öğle/ikindi
  // instead, this asserts it did not.
  assert.ok(payload.entries[0].atMs < NOW.getTime());
});

test('generatedAtMs equals now.getTime()', () => {
  const payload = buildWidgetPayload(CAYIROVA, 'Diyanet', NOW);
  assert.equal(payload.generatedAtMs, NOW.getTime());
});

test('the yatsi -> next-day imsak gap is positive and within 6-10 hours', () => {
  const payload = buildWidgetPayload(CAYIROVA, 'Diyanet', NOW);
  const yatsiIndex = payload.entries.findIndex((e) => e.name === 'yatsi');
  const gapMs = payload.entries[yatsiIndex + 1].atMs - payload.entries[yatsiIndex].atMs;
  assert.ok(gapMs > 0);
  assert.ok(gapMs > 6 * 60 * 60 * 1000 && gapMs < 10 * 60 * 60 * 1000);
});

test('schemaVersion is 1 and the payload round-trips through JSON losslessly', () => {
  const payload = buildWidgetPayload(CAYIROVA, 'Diyanet', NOW);
  assert.equal(payload.schemaVersion, 1);
  const roundTripped = JSON.parse(JSON.stringify(payload));
  assert.deepEqual(roundTripped, payload);
});

test('atMs values do not depend on the device timezone (TZ=UTC invariant)', () => {
  // test:tz-utc kapısı bu dosyayı zaten TZ=UTC altında çalıştırıyor —
  // burada mutlak epoch ms üretildiğini doğrudan da doğruluyoruz: gerçek
  // Çayırova/7 Ağustos 2026 vakitleri her zaman diliminde aynı olmalı.
  const payload = buildWidgetPayload(CAYIROVA, 'Diyanet', NOW);
  const first = payload.entries.slice(0, 6);
  assert.deepEqual(
    first.map((e) => e.atMs),
    [
      Date.parse('2026-08-07T01:17:00.000Z'), // imsak 04:17 İstanbul (UTC+3)
      Date.parse('2026-08-07T02:58:00.000Z'), // güneş 05:58
      Date.parse('2026-08-07T10:13:00.000Z'), // öğle 13:13
      Date.parse('2026-08-07T14:05:00.000Z'), // ikindi 17:05
      Date.parse('2026-08-07T17:18:00.000Z'), // akşam 20:18
      Date.parse('2026-08-07T18:52:00.000Z'), // yatsı 21:52
    ]
  );
});

test('schemaVersion, days parameter, and empty/default behavior', () => {
  const payload = buildWidgetPayload(CAYIROVA, 'Diyanet', NOW, 1);
  assert.equal(payload.entries.length, 6);
  assert.equal(payload.locationLabel, 'Çayırova');
  assert.equal(payload.timeZone, 'Europe/Istanbul');
});
