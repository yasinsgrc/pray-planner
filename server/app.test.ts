import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { NotificationSettings } from '../src/types';
import { createApp } from './app';
import { createSubscriptionStore } from './subscriptionStore';

async function withServer(
  run: (baseUrl: string, store: ReturnType<typeof createSubscriptionStore>) => Promise<void>
) {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-app-'));
  const store = createSubscriptionStore(path.join(dir, 'subs.json'));
  const app = createApp({ store, vapidPublicKey: 'test-public-key' });
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`, store);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
}

const validBody = {
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
    imsak: 'ezan',
    gunes: 'sessiz',
    ogle: 'ezan',
    ikindi: 'ezan',
    aksam: 'ezan',
    yatsi: 'ezan',
    earlyWarningMinutes: 15,
    earlyWarningSound: 'tini',
  } satisfies NotificationSettings,
};

test('GET /api/vapid-public-key returns the configured key', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/vapid-public-key`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.publicKey, 'test-public-key');
  });
});

test('POST /api/subscribe stores a valid subscription', async () => {
  await withServer(async (baseUrl, store) => {
    const res = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    assert.equal(res.status, 200);
    const subs = store.loadSubscriptions();
    assert.equal(subs.length, 1);
    assert.equal(subs[0].endpoint, validBody.endpoint);
  });
});

test('POST /api/subscribe rejects a request missing required fields', async () => {
  await withServer(async (baseUrl, store) => {
    const { location, ...incomplete } = validBody;
    const res = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incomplete),
    });

    assert.equal(res.status, 400);
    assert.equal(store.loadSubscriptions().length, 0);
  });
});

test('POST /api/unsubscribe removes a stored subscription', async () => {
  await withServer(async (baseUrl, store) => {
    store.upsertSubscription({ ...validBody, updatedAt: new Date().toISOString() });

    const res = await fetch(`${baseUrl}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: validBody.endpoint }),
    });

    assert.equal(res.status, 200);
    assert.equal(store.loadSubscriptions().length, 0);
  });
});
