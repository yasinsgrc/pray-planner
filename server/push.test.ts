import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPushSender } from './push';
import type { PushSubscriptionRecord } from './types';

function makeRecord(): PushSubscriptionRecord {
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
    notifications: {
      imsak: 'bildirim',
      gunes: 'sessiz',
      ogle: 'bildirim',
      ikindi: 'bildirim',
      aksam: 'bildirim',
      yatsi: 'bildirim',
      earlyWarningMinutes: 15,
      earlyWarningSound: 'bildirim',
    },
    updatedAt: new Date().toISOString(),
  };
}

test('sends a payload containing the prayer title and does not call onExpired on success', async () => {
  const calls: { subscription: unknown; payload: string }[] = [];
  let expiredEndpoint: string | null = null;

  const sendPush = createPushSender({
    sendNotification: async (subscription, payload) => {
      calls.push({ subscription, payload });
    },
    onExpired: (endpoint) => {
      expiredEndpoint = endpoint;
    },
  });

  await sendPush(makeRecord(), { type: 'prayer', prayerName: 'ogle', label: 'Öğle', soundMode: 'bildirim' });

  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].payload);
  assert.equal(body.title, 'Öğle Vakti Girdi');
  assert.equal(expiredEndpoint, null);
});

test('removes the subscription when the push service reports it as gone (410)', async () => {
  let expiredEndpoint: string | null = null;

  const sendPush = createPushSender({
    sendNotification: async () => {
      const err = new Error('Gone') as Error & { statusCode: number };
      err.statusCode = 410;
      throw err;
    },
    onExpired: (endpoint) => {
      expiredEndpoint = endpoint;
    },
  });

  await sendPush(makeRecord(), { type: 'prayer', prayerName: 'ogle', label: 'Öğle', soundMode: 'bildirim' });

  assert.equal(expiredEndpoint, 'https://push.example.com/a');
});

test('does not call onExpired for a non-expiry error', async () => {
  let expiredEndpoint: string | null = null;
  const originalConsoleError = console.error;
  console.error = () => {};

  const sendPush = createPushSender({
    sendNotification: async () => {
      throw new Error('network down');
    },
    onExpired: (endpoint) => {
      expiredEndpoint = endpoint;
    },
  });

  await sendPush(makeRecord(), { type: 'prayer', prayerName: 'ogle', label: 'Öğle', soundMode: 'bildirim' });

  console.error = originalConsoleError;
  assert.equal(expiredEndpoint, null);
});
