import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from './app';
import { createInMemoryPushStore } from './pushStore';
import type { PushStore } from './pushStore';
import type { GeocodingClient } from './geocoding';
import { GeocodingRateLimitedError } from './geocoding';
import type { DailyVerseService } from './dailyVerse';

const CORS_ALLOWED_ORIGIN = 'https://vakit.yasinsigirci.com.tr';

function createFakeGeocodingClient(overrides: Partial<GeocodingClient> = {}): GeocodingClient {
  return {
    searchLocations: async () => [],
    ...overrides,
  };
}

function createFakeDailyVerseService(overrides: Partial<DailyVerseService> = {}): DailyVerseService {
  return {
    getVerseOfTheDay: async () => ({ verse: 'Test ayet', verseRef: 'Test Suresi, 1. Ayet' }),
    ...overrides,
  };
}

async function withServer(
  run: (baseUrl: string, pushStore: PushStore) => Promise<void>,
  opts: {
    geocodingClient?: GeocodingClient;
    dailyVerseService?: DailyVerseService;
    pushStore?: PushStore;
  } = {}
) {
  const pushStore = opts.pushStore ?? createInMemoryPushStore();
  const app = createApp({
    pushStore,
    vapidPublicKey: 'test-public-key',
    geocodingClient: opts.geocodingClient ?? createFakeGeocodingClient(),
    dailyVerseService: opts.dailyVerseService ?? createFakeDailyVerseService(),
    corsAllowedOrigin: CORS_ALLOWED_ORIGIN,
  });
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`, pushStore);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const validScheduleBody = {
  endpoint: 'https://push.example.com/a',
  keys: { p256dh: 'p', auth: 'a' },
  schedule: [{ fireAt: '2026-08-10T02:30:00.000Z', prayerKey: 'imsak' }],
};

test('GET /health returns 200 ok with a service discriminator when the store is healthy', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type')?.includes('application/json'), true);
    assert.equal(body.ok, true);
    // useApiAvailable.ts (design-refresh-v3 Faz 9 M1) checks this exact
    // field to tell a real /health response apart from a static host's SPA
    // fallback answering the same path with 200 + index.html.
    assert.equal(body.service, 'vakit-api');
    assert.equal(body.db, 'connected');
  });
});

test('GET /health returns 503 when the store reports it is unhealthy (real DB check)', async () => {
  const unhealthyStore: PushStore = {
    ...createInMemoryPushStore(),
    checkHealth: async () => false,
  };
  await withServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/health`);
      const body = await res.json();
      assert.equal(res.status, 503);
      assert.equal(body.ok, false);
    },
    { pushStore: unhealthyStore }
  );
});

test('GET /api/vapid-public-key returns the configured key', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/vapid-public-key`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.publicKey, 'test-public-key');
  });
});

test('POST /api/push/subscribe stores a subscription and its schedule', async () => {
  await withServer(async (baseUrl, pushStore) => {
    const res = await fetch(`${baseUrl}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validScheduleBody),
    });

    assert.equal(res.status, 200);
    const due = await pushStore.claimDueSchedules(new Date('2026-08-10T02:30:01.000Z'));
    assert.equal(due.length, 1);
    assert.equal(due[0].prayerKey, 'imsak');
  });
});

test('POST /api/push/subscribe rejects a request missing endpoint', async () => {
  await withServer(async (baseUrl) => {
    const { endpoint, ...incomplete } = validScheduleBody;
    const res = await fetch(`${baseUrl}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incomplete),
    });
    assert.equal(res.status, 400);
  });
});

test('POST /api/push/subscribe rejects a request missing keys', async () => {
  await withServer(async (baseUrl) => {
    const { keys, ...incomplete } = validScheduleBody;
    const res = await fetch(`${baseUrl}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incomplete),
    });
    assert.equal(res.status, 400);
  });
});

test('POST /api/push/subscribe rejects a schedule entry with an invalid fireAt', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validScheduleBody, schedule: [{ fireAt: 'not-a-date', prayerKey: 'imsak' }] }),
    });
    assert.equal(res.status, 400);
  });
});

test('POST /api/push/subscribe rejects a schedule exceeding the maximum entry count', async () => {
  await withServer(async (baseUrl) => {
    const schedule = Array.from({ length: 401 }, (_, i) => ({
      fireAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      prayerKey: 'imsak',
    }));
    const res = await fetch(`${baseUrl}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validScheduleBody, schedule }),
    });
    assert.equal(res.status, 400);
  });
});

test('POST /api/push/schedule replaces an existing schedule rather than merging it', async () => {
  await withServer(async (baseUrl, pushStore) => {
    await fetch(`${baseUrl}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validScheduleBody),
    });

    const res = await fetch(`${baseUrl}/api/push/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validScheduleBody,
        schedule: [{ fireAt: '2026-08-10T12:00:00.000Z', prayerKey: 'ogle' }],
      }),
    });

    assert.equal(res.status, 200);
    const due = await pushStore.claimDueSchedules(new Date('2026-08-10T12:00:01.000Z'));
    assert.equal(due.length, 1);
    assert.equal(due[0].prayerKey, 'ogle', 'the old imsak entry must be gone, not merged with');
  });
});

test('DELETE /api/push/unsubscribe removes the subscription and its schedule', async () => {
  await withServer(async (baseUrl, pushStore) => {
    await fetch(`${baseUrl}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validScheduleBody),
    });

    const res = await fetch(`${baseUrl}/api/push/unsubscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: validScheduleBody.endpoint }),
    });

    assert.equal(res.status, 200);
    const due = await pushStore.claimDueSchedules(new Date('2026-08-10T02:30:01.000Z'));
    assert.equal(due.length, 0);
    assert.equal((await pushStore.listSubscriptions()).length, 0);
  });
});

test('DELETE /api/push/unsubscribe rejects a request missing endpoint', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/push/unsubscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });
});

test('DELETE /api/push/unsubscribe does not throw for an endpoint that was never subscribed', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/push/unsubscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example.com/never-existed' }),
    });
    assert.equal(res.status, 200);
  });
});

test('CORS: a preflight from a non-allowed origin is rejected on the real app', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/push/subscribe`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(res.status, 403);
  });
});

test('CORS: the configured origin is allowed on the real app', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`, { headers: { Origin: CORS_ALLOWED_ORIGIN } });
    assert.equal(res.headers.get('access-control-allow-origin'), CORS_ALLOWED_ORIGIN);
  });
});

test('rate limiting: POST /api/push/subscribe is limited on the real app', async () => {
  await withServer(async (baseUrl) => {
    let lastStatus = 200;
    for (let i = 0; i < 15; i++) {
      const res = await fetch(`${baseUrl}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validScheduleBody, endpoint: `https://push.example.com/${i}` }),
      });
      lastStatus = res.status;
    }
    assert.equal(lastStatus, 429);
  });
});

test('GET /api/geocode returns mapped results from the geocoding client', async () => {
  const fakeClient = createFakeGeocodingClient({
    searchLocations: async (query) => {
      assert.equal(query, 'ankara');
      return [
        {
          id: 'x',
          cityName: 'Ankara',
          districtName: 'Çankaya',
          country: 'Türkiye',
          lat: 39.9,
          lng: 32.8,
        },
      ];
    },
  });

  await withServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/geocode?q=ankara`);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.results.length, 1);
      assert.equal(body.results[0].cityName, 'Ankara');
    },
    { geocodingClient: fakeClient }
  );
});

test('GET /api/geocode rejects a query shorter than 3 characters', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/geocode?q=an`);
    assert.equal(res.status, 400);
  });
});

test('GET /api/geocode returns 502 when the geocoding client throws', async () => {
  const fakeClient = createFakeGeocodingClient({
    searchLocations: async () => {
      throw new Error('network down');
    },
  });

  await withServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/geocode?q=ankara`);
      assert.equal(res.status, 502);
    },
    { geocodingClient: fakeClient }
  );
});

test('GET /api/geocode returns 503 with a friendly message when Nominatim is rate-limited', async () => {
  const fakeClient = createFakeGeocodingClient({
    searchLocations: async () => {
      throw new GeocodingRateLimitedError('rate limited');
    },
  });

  await withServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/geocode?q=ankara`);
      const body = await res.json();
      assert.equal(res.status, 503);
      assert.equal(body.error, 'Arama servisi şu an yoğun, listeden seçebilirsiniz.');
    },
    { geocodingClient: fakeClient }
  );
});

// /api/reverse-geocode was removed entirely (design-refresh-v3 Faz 16) —
// it silently forwarded the user's real GPS coordinate to this server on
// every GPS-location tap. Confirm it's genuinely gone, not just unrouted
// by accident.
test('GET /api/reverse-geocode no longer exists', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/reverse-geocode?lat=41&lng=29`);
    assert.equal(res.status, 404);
  });
});

test('GET /api/daily-verse returns the verse from the daily verse service', async () => {
  const fakeService = createFakeDailyVerseService({
    getVerseOfTheDay: async () => ({ verse: 'Örnek meal', verseRef: 'Fâtiha Suresi, 1. Ayet' }),
  });

  await withServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/daily-verse`);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.verse, 'Örnek meal');
    },
    { dailyVerseService: fakeService }
  );
});

test('GET /api/daily-verse returns 502 when the service throws', async () => {
  const fakeService = createFakeDailyVerseService({
    getVerseOfTheDay: async () => {
      throw new Error('down');
    },
  });

  await withServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/daily-verse`);
      assert.equal(res.status, 502);
    },
    { dailyVerseService: fakeService }
  );
});
