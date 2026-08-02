import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { NotificationSettings } from '../src/types';
import { createApp } from './app';
import { createSubscriptionStore } from './subscriptionStore';
import type { GeocodingClient } from './geocoding';
import { GeocodingRateLimitedError } from './geocoding';
import type { DailyVerseService } from './dailyVerse';

function createFakeGeocodingClient(overrides: Partial<GeocodingClient> = {}): GeocodingClient {
  return {
    searchLocations: async () => [],
    reverseGeocode: async () => null,
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
  run: (baseUrl: string, store: ReturnType<typeof createSubscriptionStore>) => Promise<void>,
  geocodingClient: GeocodingClient = createFakeGeocodingClient(),
  dailyVerseService: DailyVerseService = createFakeDailyVerseService()
) {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-app-'));
  const store = createSubscriptionStore(path.join(dir, 'subs.json'));
  const app = createApp({ store, vapidPublicKey: 'test-public-key', geocodingClient, dailyVerseService });
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
    imsak: 'bildirim',
    gunes: 'sessiz',
    ogle: 'bildirim',
    ikindi: 'bildirim',
    aksam: 'bildirim',
    yatsi: 'bildirim',
    earlyWarningMinutes: 15,
    earlyWarningSound: 'bildirim',
  } satisfies NotificationSettings,
};

test('GET /health returns 200 ok with a service discriminator the client checks for', async () => {
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
  });
});

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
    const subs = await store.loadSubscriptions();
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
    assert.equal((await store.loadSubscriptions()).length, 0);
  });
});

test('POST /api/unsubscribe removes a stored subscription', async () => {
  await withServer(async (baseUrl, store) => {
    await store.upsertSubscription({ ...validBody, updatedAt: new Date().toISOString() });

    const res = await fetch(`${baseUrl}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: validBody.endpoint }),
    });

    assert.equal(res.status, 200);
    assert.equal((await store.loadSubscriptions()).length, 0);
  });
});

test('DELETE /api/subscribe removes the matching record — the Gizlilik Politikası "kayıt silinir" promise', async () => {
  await withServer(async (baseUrl, store) => {
    await store.upsertSubscription({ ...validBody, updatedAt: new Date().toISOString() });

    const res = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: validBody.endpoint }),
    });

    assert.equal(res.status, 200);
    const subs = await store.loadSubscriptions();
    assert.equal(subs.length, 0);
  });
});

test('DELETE /api/subscribe rejects a request missing endpoint', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });
});

test('DELETE /api/subscribe does not throw or error when the endpoint was never subscribed', async () => {
  await withServer(async (baseUrl, store) => {
    const res = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example.com/never-existed' }),
    });

    assert.equal(res.status, 200);
    assert.equal((await store.loadSubscriptions()).length, 0);
  });
});

test('DELETE /api/subscribe only removes the matching record, leaving others untouched', async () => {
  await withServer(async (baseUrl, store) => {
    await store.upsertSubscription({ ...validBody, updatedAt: new Date().toISOString() });
    const other = { ...validBody, endpoint: 'https://push.example.com/other', updatedAt: new Date().toISOString() };
    await store.upsertSubscription(other);

    const res = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: validBody.endpoint }),
    });

    assert.equal(res.status, 200);
    const subs = await store.loadSubscriptions();
    assert.equal(subs.length, 1);
    assert.equal(subs[0].endpoint, other.endpoint);
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

  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/geocode?q=ankara`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.results.length, 1);
    assert.equal(body.results[0].cityName, 'Ankara');
  }, fakeClient);
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

  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/geocode?q=ankara`);
    assert.equal(res.status, 502);
  }, fakeClient);
});

test('GET /api/geocode returns 503 with a friendly message when Nominatim is rate-limited', async () => {
  const fakeClient = createFakeGeocodingClient({
    searchLocations: async () => {
      throw new GeocodingRateLimitedError('rate limited');
    },
  });

  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/geocode?q=ankara`);
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.equal(body.error, 'Arama servisi şu an yoğun, listeden seçebilirsiniz.');
  }, fakeClient);
});

test('GET /api/reverse-geocode returns a mapped location', async () => {
  const fakeClient = createFakeGeocodingClient({
    reverseGeocode: async (lat, lng) => {
      assert.equal(lat, 41);
      assert.equal(lng, 29);
      return { id: 'y', cityName: 'İstanbul', districtName: '', country: 'Türkiye', lat, lng };
    },
  });

  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/reverse-geocode?lat=41&lng=29`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.location.cityName, 'İstanbul');
  }, fakeClient);
});

test('GET /api/reverse-geocode rejects non-numeric coordinates', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/reverse-geocode?lat=abc&lng=29`);
    assert.equal(res.status, 400);
  });
});

test('GET /api/reverse-geocode returns location: null when nothing is found', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/reverse-geocode?lat=0&lng=0`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.location, null);
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
      assert.equal(body.verseRef, 'Fâtiha Suresi, 1. Ayet');
    },
    undefined,
    fakeService
  );
});

test('GET /api/daily-verse returns 502 when the service throws', async () => {
  const fakeService = createFakeDailyVerseService({
    getVerseOfTheDay: async () => {
      throw new Error('network down');
    },
  });

  await withServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/daily-verse`);
      assert.equal(res.status, 502);
    },
    undefined,
    fakeService
  );
});
