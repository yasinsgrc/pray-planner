import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createSubscriptionStore, createPostgresSubscriptionStore } from './subscriptionStore';
import type { PgPoolLike } from './subscriptionStore';
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

test('creates an empty subscriptions file on first load', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  const store = createSubscriptionStore(filePath);

  const subs = await store.loadSubscriptions();

  assert.deepEqual(subs, []);
  assert.equal(existsSync(filePath), true);
  rmSync(dir, { recursive: true, force: true });
});

test('upsertSubscription adds a new record and persists it to disk', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  const store = createSubscriptionStore(filePath);

  await store.upsertSubscription(makeRecord('https://push.example.com/a'));

  const subs = await store.loadSubscriptions();
  assert.equal(subs.length, 1);
  assert.equal(subs[0].endpoint, 'https://push.example.com/a');

  const onDisk = JSON.parse(readFileSync(filePath, 'utf-8'));
  assert.equal(onDisk.length, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('upsertSubscription replaces an existing record with the same endpoint', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  const store = createSubscriptionStore(filePath);

  await store.upsertSubscription(makeRecord('https://push.example.com/a'));
  const updated = { ...makeRecord('https://push.example.com/a'), calculationMethod: 'MWL' };
  await store.upsertSubscription(updated);

  const subs = await store.loadSubscriptions();
  assert.equal(subs.length, 1);
  assert.equal(subs[0].calculationMethod, 'MWL');
  rmSync(dir, { recursive: true, force: true });
});

test('loadSubscriptions returns an empty array instead of throwing when the file is corrupted', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  writeFileSync(filePath, '{ not valid json ][', 'utf-8');
  const store = createSubscriptionStore(filePath);

  const subs = await store.loadSubscriptions();

  assert.deepEqual(subs, []);
  rmSync(dir, { recursive: true, force: true });
});

test('removeSubscription deletes a record by endpoint', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  const store = createSubscriptionStore(filePath);

  await store.upsertSubscription(makeRecord('https://push.example.com/a'));
  await store.upsertSubscription(makeRecord('https://push.example.com/b'));
  await store.removeSubscription('https://push.example.com/a');

  const subs = await store.loadSubscriptions();
  assert.equal(subs.length, 1);
  assert.equal(subs[0].endpoint, 'https://push.example.com/b');
  rmSync(dir, { recursive: true, force: true });
});

/**
 * A minimal in-memory stand-in for `pg`'s Pool, just enough to exercise the
 * three SQL statements createPostgresSubscriptionStore issues, without a
 * real database in the test run.
 */
function createFakePgPool(): PgPoolLike {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    async query(text: string, params: unknown[] = []) {
      const sql = text.trim().toUpperCase();
      if (sql.startsWith('CREATE TABLE')) {
        return { rows: [] };
      }
      if (sql.startsWith('SELECT')) {
        return { rows: [...rows.values()].map((record) => ({ record })) };
      }
      if (sql.startsWith('INSERT')) {
        const [endpoint, recordJson] = params as [string, string];
        rows.set(endpoint, JSON.parse(recordJson));
        return { rows: [] };
      }
      if (sql.startsWith('DELETE')) {
        const [endpoint] = params as [string];
        rows.delete(endpoint);
        return { rows: [] };
      }
      throw new Error(`fake pg pool: unhandled query ${text}`);
    },
  };
}

test('postgres store: upsert adds a record readable by loadSubscriptions', async () => {
  const pool = createFakePgPool();
  const store = await createPostgresSubscriptionStore(pool);

  await store.upsertSubscription(makeRecord('https://push.example.com/a'));
  const subs = await store.loadSubscriptions();

  assert.equal(subs.length, 1);
  assert.equal(subs[0].endpoint, 'https://push.example.com/a');
});

test('postgres store: upsert with the same endpoint replaces, not duplicates', async () => {
  const pool = createFakePgPool();
  const store = await createPostgresSubscriptionStore(pool);

  await store.upsertSubscription(makeRecord('https://push.example.com/a'));
  await store.upsertSubscription({ ...makeRecord('https://push.example.com/a'), calculationMethod: 'MWL' });
  const subs = await store.loadSubscriptions();

  assert.equal(subs.length, 1);
  assert.equal(subs[0].calculationMethod, 'MWL');
});

test('postgres store: removeSubscription deletes by endpoint', async () => {
  const pool = createFakePgPool();
  const store = await createPostgresSubscriptionStore(pool);

  await store.upsertSubscription(makeRecord('https://push.example.com/a'));
  await store.upsertSubscription(makeRecord('https://push.example.com/b'));
  await store.removeSubscription('https://push.example.com/a');
  const subs = await store.loadSubscriptions();

  assert.equal(subs.length, 1);
  assert.equal(subs[0].endpoint, 'https://push.example.com/b');
});

test('postgres store: creates its table on construction', async () => {
  const queries: string[] = [];
  const pool: PgPoolLike = {
    async query(text) {
      queries.push(text.trim());
      return { rows: [] };
    },
  };

  await createPostgresSubscriptionStore(pool);

  assert.ok(queries[0].toUpperCase().startsWith('CREATE TABLE'));
});
