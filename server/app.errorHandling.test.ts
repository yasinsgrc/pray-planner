import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from './app';
import type { PushStore } from './pushStore';
import type { GeocodingClient } from './geocoding';
import type { DailyVerseService } from './dailyVerse';

const CORS_ALLOWED_ORIGIN = 'https://vakit.yasinsigirci.com.tr';

/**
 * A store whose write paths always reject — the exact shape of a Postgres
 * outage (connection lost, pool exhausted, constraint violation). The
 * Postgres store deliberately does NOT catch these internally; only
 * checkHealth() does. Express 4 does not forward an async handler's
 * rejection to error-handling middleware, so before this was fixed such a
 * rejection escaped as an unhandledRejection — which under Node's default
 * mode kills the whole process, taking every other user's request with it,
 * while the request that triggered it never got a response at all.
 */
function createFailingPushStore(): PushStore {
  const boom = async (): Promise<never> => {
    throw new Error('DB down (simulated)');
  };
  return {
    upsertSubscriptionAndSchedule: boom,
    removeSubscription: boom,
    listSubscriptions: boom,
    claimDueSchedules: boom,
    cleanupOldSchedules: boom,
    checkHealth: async () => true,
  };
}

async function withFailingServer(run: (baseUrl: string) => Promise<void>) {
  const geocodingClient: GeocodingClient = { searchLocations: async () => [] };
  const dailyVerseService: DailyVerseService = {
    getVerseOfTheDay: async () => ({ verse: 'Test ayet', verseRef: 'Test Suresi, 1. Ayet' }),
  };
  const app = createApp({
    pushStore: createFailingPushStore(),
    vapidPublicKey: 'test-public-key',
    geocodingClient,
    dailyVerseService,
    corsAllowedOrigin: CORS_ALLOWED_ORIGIN,
  });
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

/** Runs `body` while recording anything that escapes as an unhandled
 * rejection. The listener itself is what keeps this test process alive —
 * without one, Node's default is to throw and exit, which is precisely the
 * production failure being guarded against here. */
async function recordingUnhandledRejections(body: () => Promise<void>): Promise<unknown[]> {
  const escaped: unknown[] = [];
  const onUnhandled = (reason: unknown) => escaped.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    await body();
    // Let any already-scheduled rejection callback run before we look.
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
  return escaped;
}

const validScheduleBody = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/a',
  keys: { p256dh: 'p', auth: 'a' },
  schedule: [{ fireAt: '2026-08-10T02:30:00.000Z', prayerKey: 'imsak' }],
};

const STORE_FAILURE_BODY = { error: 'Kayıt şu an yapılamıyor, biraz sonra tekrar deneyin.' };

/** A hung request never resolves, so every fetch here is bounded — without
 * the timeout a regression would hang the suite instead of failing it. */
function send(baseUrl: string, path: string, method: 'POST' | 'DELETE', body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
}

test('POST /api/push/subscribe answers 503 when the store fails, instead of hanging', async () => {
  const escaped = await recordingUnhandledRejections(async () => {
    await withFailingServer(async (baseUrl) => {
      const res = await send(baseUrl, '/api/push/subscribe', 'POST', validScheduleBody);
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), STORE_FAILURE_BODY);
    });
  });
  assert.deepEqual(escaped, [], 'no rejection may escape the route');
});

test('POST /api/push/schedule answers 503 when the store fails, instead of hanging', async () => {
  const escaped = await recordingUnhandledRejections(async () => {
    await withFailingServer(async (baseUrl) => {
      const res = await send(baseUrl, '/api/push/schedule', 'POST', validScheduleBody);
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), STORE_FAILURE_BODY);
    });
  });
  assert.deepEqual(escaped, [], 'no rejection may escape the route');
});

test('DELETE /api/push/unsubscribe answers 503 when the store fails, instead of hanging', async () => {
  const escaped = await recordingUnhandledRejections(async () => {
    await withFailingServer(async (baseUrl) => {
      const res = await send(baseUrl, '/api/push/unsubscribe', 'DELETE', {
        endpoint: 'https://fcm.googleapis.com/fcm/send/a',
      });
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), STORE_FAILURE_BODY);
    });
  });
  assert.deepEqual(escaped, [], 'no rejection may escape the route');
});

test('the server keeps serving other routes after a store failure', async () => {
  const escaped = await recordingUnhandledRejections(async () => {
    await withFailingServer(async (baseUrl) => {
      await send(baseUrl, '/api/push/subscribe', 'POST', validScheduleBody);

      // The process surviving is the whole point: a health probe right
      // after the failure must still answer.
      const health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { ok: true, service: 'vakit-api', db: 'connected' });
    });
  });
  assert.deepEqual(escaped, [], 'no rejection may escape the route');
});
