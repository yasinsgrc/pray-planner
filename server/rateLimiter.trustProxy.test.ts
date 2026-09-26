import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from './app';
import { createRateLimiter } from './rateLimiter';
import { createInMemoryPushStore } from './pushStore';
import type { GeocodingClient } from './geocoding';
import type { DailyVerseService } from './dailyVerse';

const CORS_ALLOWED_ORIGIN = 'https://vakit.yasinsigirci.com.tr';

/**
 * Behind exactly one proxy (Railway), the proxy APPENDS the connecting
 * peer's address to X-Forwarded-For. So a request that arrives carrying a
 * client-supplied header ends up as "<whatever the client wrote>, <the
 * real client IP>": everything left of the last entry is attacker-
 * controlled, only the rightmost entry is the proxy's own observation.
 *
 * `trust proxy: true` makes Express believe the whole chain and take the
 * LEFTMOST value, so rotating the forged part handed out a fresh
 * rate-limit bucket on every single request — the limiter could be walked
 * straight past, and each forged address also left a permanent entry in
 * the limiter's map.
 */
function forwardedFor(forged: string, realClientIp = '203.0.113.9'): string {
  return `${forged}, ${realClientIp}`;
}

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const geocodingClient: GeocodingClient = { searchLocations: async () => [] };
  const dailyVerseService: DailyVerseService = {
    getVerseOfTheDay: async () => ({ verse: 'Test ayet', verseRef: 'Test Suresi, 1. Ayet' }),
  };
  const app = createApp({
    pushStore: createInMemoryPushStore(),
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

const validScheduleBody = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/a',
  keys: { p256dh: 'p', auth: 'a' },
  schedule: [{ fireAt: '2026-08-10T02:30:00.000Z', prayerKey: 'imsak' }],
};

function subscribe(baseUrl: string, xff: string) {
  return fetch(`${baseUrl}/api/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': xff },
    body: JSON.stringify(validScheduleBody),
    signal: AbortSignal.timeout(3000),
  }).then((res) => res.status);
}

test('a forged X-Forwarded-For prefix cannot buy a fresh rate-limit bucket', async () => {
  await withServer(async (baseUrl) => {
    const statuses: number[] = [];
    // Same real client throughout; only the forgeable prefix rotates.
    for (let i = 0; i < 40; i++) {
      statuses.push(await subscribe(baseUrl, forwardedFor(`10.0.0.${i}`)));
    }

    // SUBSCRIBE_RATE_LIMIT is 10 per 60s, so exactly the first 10 pass.
    assert.equal(statuses.filter((s) => s === 200).length, 10);
    assert.equal(statuses.filter((s) => s === 429).length, 30);
  });
});

test('two genuinely different clients still get their own buckets', async () => {
  await withServer(async (baseUrl) => {
    for (let i = 0; i < 10; i++) {
      assert.equal(await subscribe(baseUrl, forwardedFor('10.0.0.1', '203.0.113.9')), 200);
    }
    assert.equal(await subscribe(baseUrl, forwardedFor('10.0.0.1', '203.0.113.9')), 429);

    // A different real client must be unaffected by the first one's limit.
    assert.equal(await subscribe(baseUrl, forwardedFor('10.0.0.1', '198.51.100.7')), 200);
  });
});

test('expired entries are evicted instead of accumulating forever', async () => {
  const limiter = createRateLimiter({ windowMs: 50, max: 5 });
  const call = (ip: string) =>
    new Promise<void>((resolve) => {
      limiter({ ip } as never, { status: () => ({ json: () => resolve() }) } as never, () => resolve());
    });

  for (let i = 0; i < 25; i++) await call(`10.0.0.${i}`);
  assert.equal(limiter.activeKeys(), 25);

  await new Promise((resolve) => setTimeout(resolve, 60));

  // One request after the window has elapsed must clear every stale key,
  // leaving only the key that just arrived.
  await call('198.51.100.7');
  assert.equal(limiter.activeKeys(), 1);
});
