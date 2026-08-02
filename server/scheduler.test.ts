import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldNotifyNow, createScheduler } from './scheduler';
import type { PushSubscriptionRecord } from './types';
import type { NotificationSettings } from '../src/types';
import type { DayPrayerSchedule } from '../src/utils/prayerCalculator';

function makeNotifications(overrides: Partial<NotificationSettings> = {}): NotificationSettings {
  return {
    imsak: 'ezan',
    gunes: 'sessiz',
    ogle: 'ezan',
    ikindi: 'ezan',
    aksam: 'ezan',
    yatsi: 'ezan',
    earlyWarningMinutes: 15,
    earlyWarningSound: 'tini',
    ...overrides,
  };
}

test('shouldNotifyNow returns a prayer event when now matches the prayer time', () => {
  const prayerTime = new Date('2026-08-01T12:00:00.000Z');
  const now = new Date('2026-08-01T12:00:10.000Z');
  const event = shouldNotifyNow({ name: 'ogle', label: 'Öğle', dateObj: prayerTime }, now, makeNotifications());

  assert.deepEqual(event, { type: 'prayer', prayerName: 'ogle', label: 'Öğle', soundMode: 'ezan' });
});

test('shouldNotifyNow returns null outside the tolerance window', () => {
  const prayerTime = new Date('2026-08-01T12:00:00.000Z');
  const now = new Date('2026-08-01T12:05:00.000Z');
  const event = shouldNotifyNow({ name: 'ogle', label: 'Öğle', dateObj: prayerTime }, now, makeNotifications());

  assert.equal(event, null);
});

test('shouldNotifyNow returns null when the prayer sound is set to sessiz', () => {
  const prayerTime = new Date('2026-08-01T06:00:00.000Z');
  const now = new Date('2026-08-01T06:00:00.000Z');
  const event = shouldNotifyNow({ name: 'gunes', label: 'Güneş', dateObj: prayerTime }, now, makeNotifications());

  assert.equal(event, null);
});

test('shouldNotifyNow returns an early-warning event before the prayer time', () => {
  const prayerTime = new Date('2026-08-01T12:15:00.000Z');
  const now = new Date('2026-08-01T12:00:00.000Z');
  const event = shouldNotifyNow({ name: 'ogle', label: 'Öğle', dateObj: prayerTime }, now, makeNotifications());

  assert.deepEqual(event, {
    type: 'early-warning',
    prayerName: 'ogle',
    label: 'Öğle',
    soundMode: 'tini',
    minutesBefore: 15,
  });
});

test('shouldNotifyNow skips the early warning when earlyWarningMinutes is 0', () => {
  const prayerTime = new Date('2026-08-01T12:15:00.000Z');
  const now = new Date('2026-08-01T12:00:00.000Z');
  const notifications = makeNotifications({ earlyWarningMinutes: 0 });
  const event = shouldNotifyNow({ name: 'ogle', label: 'Öğle', dateObj: prayerTime }, now, notifications);

  assert.equal(event, null);
});

function makeSubscription(overrides: Partial<PushSubscriptionRecord> = {}): PushSubscriptionRecord {
  return {
    endpoint: 'https://push.example.com/a',
    keys: { p256dh: 'p', auth: 'a' },
    location: {
      id: 'uskudar-istanbul',
      cityName: 'İstanbul',
      districtName: 'Üsküdar',
      country: 'Türkiye',
      lat: 41.0264,
      lng: 29.0152,
    },
    calculationMethod: 'Diyanet',
    notifications: makeNotifications(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSchedule(prayerTime: Date): DayPrayerSchedule {
  const prayer = {
    name: 'ogle' as const,
    label: 'Öğle',
    labelDative: "Öğle'ye",
    timeString: '12:00',
    dateObj: prayerTime,
    isPast: false,
    isActive: true,
    isNext: false,
  };
  return {
    date: prayerTime,
    location: makeSubscription().location,
    resolvedTimeZone: 'Europe/Istanbul',
    prayers: [prayer],
    activePrayer: prayer,
    nextPrayer: prayer,
    timeRemainingSeconds: 0,
    timeRemainingFormatted: '00:00:00',
    ringProgress: 0,
    kerahetTimes: [],
    currentKerahet: null,
    dayCycleStart: prayerTime,
    dayCycleEnd: prayerTime,
    dayCyclePrayers: [prayer],
    dayProgress: 0,
    tomorrowImsakTime: '00:00',
    tomorrowAksamTime: '00:00',
  };
}

test('scheduler tick sends a push once and skips duplicate sends in the same minute window', async () => {
  const prayerTime = new Date('2026-08-01T12:00:00.000Z');
  const sub = makeSubscription();
  const sent: unknown[] = [];

  const scheduler = createScheduler({
    store: {
      loadSubscriptions: () => [sub],
      upsertSubscription: () => {},
      removeSubscription: () => {},
    },
    calculatePrayerTimes: () => makeSchedule(prayerTime),
    sendPush: async (record, event) => {
      sent.push({ endpoint: record.endpoint, event });
    },
    now: () => prayerTime,
  });

  await scheduler.tick();
  await scheduler.tick();

  assert.equal(sent.length, 1);
});

test('scheduler tick isolates a throwing subscription so later subscriptions still get processed', async () => {
  const prayerTime = new Date('2026-08-01T12:00:00.000Z');
  const badSub = makeSubscription({ endpoint: 'https://push.example.com/bad' });
  const goodSub = makeSubscription({ endpoint: 'https://push.example.com/good' });
  const sent: unknown[] = [];

  // calculatePrayerTimes only receives the location, not the subscription, so we
  // differentiate behavior by call order: first call (badSub) throws, second call
  // (goodSub) succeeds.
  let callCount = 0;
  const scheduler = createScheduler({
    store: {
      loadSubscriptions: () => [badSub, goodSub],
      upsertSubscription: () => {},
      removeSubscription: () => {},
    },
    calculatePrayerTimes: () => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error('corrupted subscription record');
      }
      return makeSchedule(prayerTime);
    },
    sendPush: async (record, event) => {
      sent.push({ endpoint: record.endpoint, event });
    },
    now: () => prayerTime,
  });

  await scheduler.tick();

  assert.equal(sent.length, 1);
  assert.equal((sent[0] as { endpoint: string }).endpoint, goodSub.endpoint);
});

test('scheduler tick sends again on a new day for the same prayer key', async () => {
  const day1 = new Date('2026-08-01T12:00:00.000Z');
  const day2 = new Date('2026-08-02T12:00:00.000Z');
  const sub = makeSubscription();
  const sent: unknown[] = [];
  let current = day1;

  const scheduler = createScheduler({
    store: {
      loadSubscriptions: () => [sub],
      upsertSubscription: () => {},
      removeSubscription: () => {},
    },
    calculatePrayerTimes: () => makeSchedule(current),
    sendPush: async () => {
      sent.push(current);
    },
    now: () => current,
  });

  await scheduler.tick();
  current = day2;
  await scheduler.tick();

  assert.equal(sent.length, 2);
});
