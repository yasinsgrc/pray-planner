import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createSubscriptionStore } from './subscriptionStore';
import type { PushSubscriptionRecord } from './types';

function makeRecord(endpoint: string): PushSubscriptionRecord {
  return {
    endpoint,
    keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
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
      imsak: 'ezan',
      gunes: 'sessiz',
      ogle: 'ezan',
      ikindi: 'ezan',
      aksam: 'ezan',
      yatsi: 'ezan',
      earlyWarningMinutes: 15,
      earlyWarningSound: 'tini',
    },
    updatedAt: new Date().toISOString(),
  };
}

test('creates an empty subscriptions file on first load', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  const store = createSubscriptionStore(filePath);

  const subs = store.loadSubscriptions();

  assert.deepEqual(subs, []);
  assert.equal(existsSync(filePath), true);
  rmSync(dir, { recursive: true, force: true });
});

test('upsertSubscription adds a new record and persists it to disk', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  const store = createSubscriptionStore(filePath);

  store.upsertSubscription(makeRecord('https://push.example.com/a'));

  const subs = store.loadSubscriptions();
  assert.equal(subs.length, 1);
  assert.equal(subs[0].endpoint, 'https://push.example.com/a');

  const onDisk = JSON.parse(readFileSync(filePath, 'utf-8'));
  assert.equal(onDisk.length, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('upsertSubscription replaces an existing record with the same endpoint', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  const store = createSubscriptionStore(filePath);

  store.upsertSubscription(makeRecord('https://push.example.com/a'));
  const updated = { ...makeRecord('https://push.example.com/a'), calculationMethod: 'MWL' };
  store.upsertSubscription(updated);

  const subs = store.loadSubscriptions();
  assert.equal(subs.length, 1);
  assert.equal(subs[0].calculationMethod, 'MWL');
  rmSync(dir, { recursive: true, force: true });
});

test('loadSubscriptions returns an empty array instead of throwing when the file is corrupted', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  writeFileSync(filePath, '{ not valid json ][', 'utf-8');
  const store = createSubscriptionStore(filePath);

  const subs = store.loadSubscriptions();

  assert.deepEqual(subs, []);
  rmSync(dir, { recursive: true, force: true });
});

test('removeSubscription deletes a record by endpoint', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  const store = createSubscriptionStore(filePath);

  store.upsertSubscription(makeRecord('https://push.example.com/a'));
  store.upsertSubscription(makeRecord('https://push.example.com/b'));
  store.removeSubscription('https://push.example.com/a');

  const subs = store.loadSubscriptions();
  assert.equal(subs.length, 1);
  assert.equal(subs[0].endpoint, 'https://push.example.com/b');
  rmSync(dir, { recursive: true, force: true });
});
