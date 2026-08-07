import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalNotificationRequests, EZAN_CHANNEL_ID } from './notificationScheduler';
import { PushScheduleEntry } from './pushSchedule';

// Faz 23 Commit 2 — mevcut buildPushSchedule (pushSchedule.ts) çıktısını
// yerel bildirim isteklerine çeviren saf fonksiyon. Date.now() çağırmaz,
// now parametre olarak alınır.
const NOW = new Date('2026-08-07T10:00:00Z');

function entry(fireAt: string, prayerKey: string): PushScheduleEntry {
  return { fireAt, prayerKey };
}

test('buildLocalNotificationRequests maps each entry to a titled/bodied request on the ezan channel', () => {
  const entries = [entry('2026-08-07T14:05:00Z', 'ikindi')];
  const requests = buildLocalNotificationRequests(entries, NOW);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].title, 'İkindi Vakti Girdi');
  assert.equal(requests[0].body, 'Hayırlı namazlar.');
  assert.equal(requests[0].channelId, EZAN_CHANNEL_ID);
  assert.equal(requests[0].at.getTime(), new Date('2026-08-07T14:05:00Z').getTime());
});

test('buildLocalNotificationRequests assigns sequential, unique integer ids starting at 0', () => {
  const entries = [
    entry('2026-08-07T14:05:00Z', 'ikindi'),
    entry('2026-08-07T17:18:00Z', 'aksam'),
    entry('2026-08-07T18:52:00Z', 'yatsi'),
  ];
  const requests = buildLocalNotificationRequests(entries, NOW);

  assert.deepEqual(
    requests.map((r) => r.id),
    [0, 1, 2]
  );
});

test('buildLocalNotificationRequests drops entries whose fire time is not after now (defensive re-filter)', () => {
  const entries = [
    entry('2026-08-07T09:00:00Z', 'ogle'), // NOW'dan önce
    entry('2026-08-07T14:05:00Z', 'ikindi'), // NOW'dan sonra
  ];
  const requests = buildLocalNotificationRequests(entries, NOW);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].title, 'İkindi Vakti Girdi');
});

test('buildLocalNotificationRequests silently skips an unrecognized prayerKey instead of scheduling a garbled notification', () => {
  const entries = [entry('2026-08-07T14:05:00Z', 'not-a-real-key')];
  const requests = buildLocalNotificationRequests(entries, NOW);

  assert.equal(requests.length, 0);
});

test('buildLocalNotificationRequests handles an empty schedule', () => {
  assert.deepEqual(buildLocalNotificationRequests([], NOW), []);
});
