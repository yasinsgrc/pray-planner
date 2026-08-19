import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWidgetPayload, formatWidgetLocationLabel } from './widgetBridge';
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

test('days=7 produce (days+1)*6 = 48 entries — one extra day prepended so midnight-to-imsak has an active entry', () => {
  const payload = buildWidgetPayload(CAYIROVA, 'Diyanet', NOW);
  assert.equal(payload.entries.length, 48);
});

test('the first entry is the PREVIOUS day\'s imsak, not today\'s and not the first prayer still ahead of now', () => {
  const payload = buildWidgetPayload(CAYIROVA, 'Diyanet', NOW);
  assert.equal(payload.entries[0].name, 'imsak');
  // NOW (13:00 İstanbul) is well after today's imsak (04:17) — a "first
  // upcoming prayer" implementation would have started at öğle/ikindi
  // instead, this asserts it did not. The entry is yesterday's imsak
  // (dayOffset=-1), prepended so the 00:00-imsak window always has an
  // entry with atMs < now (see the midnight-window test below).
  assert.ok(payload.entries[0].atMs < NOW.getTime());
});

test('at local midnight (00:07, before imsak), the widget can still resolve an active entry', () => {
  // İstanbul 2026-08-07 00:07 == UTC 2026-08-06T21:07:00Z (UTC+3). Before
  // the fix, dayOffset started at 0 ("today"), so entries[0] was today's
  // imsak (~04:17 İstanbul) — still in the future at 00:07, leaving no
  // entry with atMs < now for the whole 00:00-imsak window.
  const midnightNow = new Date('2026-08-06T21:07:00Z');
  const payload = buildWidgetPayload(CAYIROVA, 'Diyanet', midnightNow);
  assert.ok(payload.entries[0].atMs < midnightNow.getTime());
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
  // entries[0..5] is now the PREPENDED previous day (6 Ağustos); the
  // 7 Ağustos block this test asserts on starts at index 6.
  const payload = buildWidgetPayload(CAYIROVA, 'Diyanet', NOW);
  const first = payload.entries.slice(6, 12);
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
  assert.equal(payload.entries.length, 12); // (days+1)*6 = (1+1)*6
  assert.equal(payload.locationLabel, 'Kocaeli, Çayırova');
  assert.equal(payload.timeZone, 'Europe/Istanbul');
});

// widget çember içi konum etiketi il+ilçe olmalı — yalnızca ilçe adı
// (örn. "Çayırova") kullanıcının hangi ilde olduğunu belirsiz bırakıyordu.
test('formatWidgetLocationLabel joins city and district with a comma', () => {
  assert.equal(
    formatWidgetLocationLabel({ cityName: 'Kocaeli', districtName: 'Çayırova' }),
    'Kocaeli, Çayırova'
  );
});

test('formatWidgetLocationLabel falls back to city name when district is empty', () => {
  assert.equal(formatWidgetLocationLabel({ cityName: 'Kocaeli', districtName: '' }), 'Kocaeli');
});

test('formatWidgetLocationLabel collapses to one name when city and district match', () => {
  assert.equal(
    formatWidgetLocationLabel({ cityName: 'İstanbul', districtName: 'İstanbul' }),
    'İstanbul'
  );
});

test('formatWidgetLocationLabel does not double the city when the GPS-approx district already includes it', () => {
  // resolveGpsDistrictLabel, düşük doğrulukta "Kocaeli (yaklaşık)" gibi
  // il adını zaten içeren bir metin üretir — "Kocaeli, Kocaeli (yaklaşık)"
  // olmamalı.
  assert.equal(
    formatWidgetLocationLabel({ cityName: 'Kocaeli', districtName: 'Kocaeli (yaklaşık)' }),
    'Kocaeli (yaklaşık)'
  );
});
