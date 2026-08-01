# Konum Arama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `LocationModal`'a gerçek şehir/ilçe arama (Nominatim üzerinden) ve GPS→gerçek yer adı çözümü eklemek.

**Architecture:** Mevcut Express backend'e `server/geocoding.ts` (Nominatim'e uygun `User-Agent` ile bağlanan, DI'lı bir istemci) ve iki yeni route eklenir; frontend bu route'ları debounce'lu bir arama ile çağırır.

**Tech Stack:** Node'un yerleşik global `fetch`'i (server tarafında), Express, `node:test`. Yeni bir npm bağımlılığı gerekmez.

## Global Constraints

- Nominatim'e her istekte `User-Agent: VAKIT-Namaz-App/1.0 (https://github.com/yasinsgrc/pray-planner)` başlığı gönderilir.
- Arama kutusu boşken davranış değişmez (mevcut 16 şehirlik sabit liste görünür); arama sonuçları ayrı bir "Arama Sonuçları" bölümünde, sabit listenin *üstünde* gösterilir.
- Ağ hatası → sabit liste her zaman görünür kalır, asla boş ekran.
- GPS reverse-geocode başarısız olursa mevcut sabit "Mevcut Konum / GPS Tespiti" davranışına sessizce düşülür (regresyon yok).
- Tüm kullanıcıya görünen metinler Türkçe.
- Yeni bir frontend test framework'ü eklenmez.

---

### Task 1: Geocoding İstemcisi (server/geocoding.ts)

**Files:**
- Create: `server/geocoding.ts`
- Test: `server/geocoding.test.ts`

**Interfaces:**
- Produces: `NominatimAddress`, `NominatimResult` tipleri; `mapNominatimResultToLocationItem(result: NominatimResult): LocationItem`; `GeocodingClient` arayüzü (`{ searchLocations(query: string): Promise<LocationItem[]>; reverseGeocode(lat: number, lng: number): Promise<LocationItem | null> }`); `createGeocodingClient(fetchImpl?: typeof fetch): GeocodingClient` — Task 3 bunu `createGeocodingClient()` (parametresiz, gerçek `fetch` ile) şeklinde çağıracak.

- [ ] **Step 1: Başarısız testi yaz — server/geocoding.test.ts**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapNominatimResultToLocationItem, createGeocodingClient } from './geocoding';

test('maps city/suburb/country fields directly when present', () => {
  const item = mapNominatimResultToLocationItem({
    lat: '41.0264',
    lon: '29.0152',
    display_name: 'Üsküdar, İstanbul, Türkiye',
    address: { city: 'İstanbul', suburb: 'Üsküdar', country: 'Türkiye' },
  });

  assert.equal(item.cityName, 'İstanbul');
  assert.equal(item.districtName, 'Üsküdar');
  assert.equal(item.country, 'Türkiye');
  assert.equal(item.lat, 41.0264);
  assert.equal(item.lng, 29.0152);
});

test('falls back to town then county when city is missing', () => {
  const item = mapNominatimResultToLocationItem({
    lat: '1',
    lon: '2',
    display_name: 'X',
    address: { town: 'Kucuk Kasaba', country: 'Türkiye' },
  });
  assert.equal(item.cityName, 'Kucuk Kasaba');

  const item2 = mapNominatimResultToLocationItem({
    lat: '1',
    lon: '2',
    display_name: 'X',
    address: { county: 'Bir Ilce', country: 'Türkiye' },
  });
  assert.equal(item2.cityName, 'Bir Ilce');
});

test('falls back to the first display_name segment when no address fields are usable', () => {
  const item = mapNominatimResultToLocationItem({
    lat: '1',
    lon: '2',
    display_name: 'Paris, France',
  });
  assert.equal(item.cityName, 'Paris');
});

test('defaults districtName and country to empty string when absent, without duplicating cityName', () => {
  const item = mapNominatimResultToLocationItem({
    lat: '1',
    lon: '2',
    display_name: 'Paris',
    address: { city: 'Paris' },
  });
  assert.equal(item.districtName, '');
  assert.equal(item.country, '');
});

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

test('searchLocations calls Nominatim with query and User-Agent, mapping results', async () => {
  let capturedUrl = '';
  let capturedHeaders: HeadersInit | undefined;
  const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedHeaders = init?.headers;
    return fakeResponse([
      {
        lat: '41.0264',
        lon: '29.0152',
        display_name: 'Üsküdar',
        address: { city: 'İstanbul', suburb: 'Üsküdar', country: 'Türkiye' },
      },
    ]);
  }) as typeof fetch;

  const client = createGeocodingClient(fakeFetch);
  const results = await client.searchLocations('üsküdar');

  assert.ok(capturedUrl.includes('nominatim.openstreetmap.org/search'));
  assert.ok(capturedUrl.includes(encodeURIComponent('üsküdar')));
  assert.deepEqual(capturedHeaders, {
    'User-Agent': 'VAKIT-Namaz-App/1.0 (https://github.com/yasinsgrc/pray-planner)',
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].cityName, 'İstanbul');
});

test('searchLocations throws when Nominatim responds with a non-ok status', async () => {
  const fakeFetch = (async () => fakeResponse([], false, 500)) as typeof fetch;
  const client = createGeocodingClient(fakeFetch);
  await assert.rejects(() => client.searchLocations('test'));
});

test('reverseGeocode returns null when Nominatim responds with a non-ok status', async () => {
  const fakeFetch = (async () => fakeResponse({}, false, 404)) as typeof fetch;
  const client = createGeocodingClient(fakeFetch);
  const result = await client.reverseGeocode(41, 29);
  assert.equal(result, null);
});

test('reverseGeocode maps a successful response', async () => {
  const fakeFetch = (async () =>
    fakeResponse({
      lat: '41',
      lon: '29',
      display_name: 'İstanbul',
      address: { city: 'İstanbul', country: 'Türkiye' },
    })) as typeof fetch;
  const client = createGeocodingClient(fakeFetch);
  const result = await client.reverseGeocode(41, 29);
  assert.equal(result?.cityName, 'İstanbul');
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `node --import tsx --test "server/geocoding.test.ts"`
Expected: FAIL — `Cannot find module './geocoding'`

- [ ] **Step 3: server/geocoding.ts implementasyonunu yaz**

```ts
import type { LocationItem } from '../src/types';

export interface NominatimAddress {
  city?: string;
  town?: string;
  county?: string;
  suburb?: string;
  state_district?: string;
  country?: string;
}

export interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

export function mapNominatimResultToLocationItem(result: NominatimResult): LocationItem {
  const address = result.address ?? {};
  const cityName =
    address.city ?? address.town ?? address.county ?? result.display_name.split(',')[0].trim();
  const districtName = address.suburb ?? address.state_district ?? '';
  const country = address.country ?? '';

  return {
    id: `nominatim-${result.lat}-${result.lon}`,
    cityName,
    districtName,
    country,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
  };
}

export interface GeocodingClient {
  searchLocations(query: string): Promise<LocationItem[]>;
  reverseGeocode(lat: number, lng: number): Promise<LocationItem | null>;
}

const USER_AGENT = 'VAKIT-Namaz-App/1.0 (https://github.com/yasinsgrc/pray-planner)';
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

export function createGeocodingClient(fetchImpl: typeof fetch = fetch): GeocodingClient {
  async function searchLocations(query: string): Promise<LocationItem[]> {
    const url = `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=8`;
    const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });

    if (!res.ok) {
      throw new Error(`Nominatim arama başarısız: ${res.status}`);
    }

    const results = (await res.json()) as NominatimResult[];
    return results.map(mapNominatimResultToLocationItem);
  }

  async function reverseGeocode(lat: number, lng: number): Promise<LocationItem | null> {
    const url = `${NOMINATIM_BASE_URL}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`;
    const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });

    if (!res.ok) {
      return null;
    }

    const result = (await res.json()) as NominatimResult;
    if (!result || !result.lat) {
      return null;
    }

    return mapNominatimResultToLocationItem(result);
  }

  return { searchLocations, reverseGeocode };
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `node --import tsx --test "server/geocoding.test.ts"`
Expected: 8 test, hepsi PASS

- [ ] **Step 5: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit` (NOT `npm run lint` — bu makinede bir shell hook çıktısını bozuyor)
Expected: `TypeScript: No errors found`

- [ ] **Step 6: Commit**

```bash
git add server/geocoding.ts server/geocoding.test.ts
git commit -m "feat: add Nominatim geocoding client with DI-friendly fetch"
```

---

### Task 2: Express Route'ları (server/app.ts)

**Files:**
- Modify: `server/app.ts` (tüm dosya değiştirilir)
- Modify: `server/app.test.ts` (tüm dosya değiştirilir)

**Interfaces:**
- Consumes: `GeocodingClient` (Task 1, `./geocoding`)
- Produces: `CreateAppDeps`'e yeni zorunlu alan `geocodingClient: GeocodingClient` eklenir; iki yeni route: `GET /api/geocode?q=` (200 → `{results: LocationItem[]}`, 400 → eksik/kısa `q`, 502 → istemci hata fırlatırsa), `GET /api/reverse-geocode?lat=&lng=` (200 → `{location: LocationItem | null}`, 400 → geçersiz sayı, 502 → istemci hata fırlatırsa)

- [ ] **Step 1: server/app.ts'nin tamamını şu içerikle değiştir**

```ts
import express, { Express } from 'express';
import type { SubscriptionStore } from './subscriptionStore';
import type { PushSubscriptionRecord } from './types';
import type { GeocodingClient } from './geocoding';

export interface CreateAppDeps {
  store: SubscriptionStore;
  vapidPublicKey: string;
  geocodingClient: GeocodingClient;
}

export function createApp(deps: CreateAppDeps): Express {
  const app = express();
  app.use(express.json());

  app.get('/api/vapid-public-key', (_req, res) => {
    res.json({ publicKey: deps.vapidPublicKey });
  });

  app.post('/api/subscribe', (req, res) => {
    const { endpoint, keys, location, calculationMethod, notifications } = req.body ?? {};

    if (!endpoint || !keys?.p256dh || !keys?.auth || !location || !calculationMethod || !notifications) {
      res.status(400).json({ error: 'Eksik abonelik alanları.' });
      return;
    }

    const record: PushSubscriptionRecord = {
      endpoint,
      keys,
      location,
      calculationMethod,
      notifications,
      updatedAt: new Date().toISOString(),
    };

    deps.store.upsertSubscription(record);
    res.status(200).json({ ok: true });
  });

  app.post('/api/unsubscribe', (req, res) => {
    const { endpoint } = req.body ?? {};

    if (!endpoint) {
      res.status(400).json({ error: 'endpoint gerekli.' });
      return;
    }

    deps.store.removeSubscription(endpoint);
    res.status(200).json({ ok: true });
  });

  app.get('/api/geocode', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (query.length < 2) {
      res.status(400).json({ error: 'q en az 2 karakter olmalı.' });
      return;
    }

    try {
      const results = await deps.geocodingClient.searchLocations(query);
      res.status(200).json({ results });
    } catch {
      res.status(502).json({ error: 'Arama sırasında bir hata oluştu.' });
    }
  });

  app.get('/api/reverse-geocode', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'lat ve lng geçerli sayılar olmalı.' });
      return;
    }

    try {
      const location = await deps.geocodingClient.reverseGeocode(lat, lng);
      res.status(200).json({ location });
    } catch {
      res.status(502).json({ error: 'Konum çözümlenirken bir hata oluştu.' });
    }
  });

  return app;
}
```

- [ ] **Step 2: server/app.test.ts'nin tamamını şu içerikle değiştir**

```ts
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

function createFakeGeocodingClient(overrides: Partial<GeocodingClient> = {}): GeocodingClient {
  return {
    searchLocations: async () => [],
    reverseGeocode: async () => null,
    ...overrides,
  };
}

async function withServer(
  run: (baseUrl: string, store: ReturnType<typeof createSubscriptionStore>) => Promise<void>,
  geocodingClient: GeocodingClient = createFakeGeocodingClient()
) {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-app-'));
  const store = createSubscriptionStore(path.join(dir, 'subs.json'));
  const app = createApp({ store, vapidPublicKey: 'test-public-key', geocodingClient });
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

test('GET /api/geocode rejects a query shorter than 2 characters', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/geocode?q=a`);
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
```

- [ ] **Step 3: Testlerin geçtiğini doğrula**

Run: `node --import tsx --test "server/app.test.ts"`
Expected: 10 test, hepsi PASS

- [ ] **Step 4: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit`
Expected: Hata verir (`server/index.ts` henüz `geocodingClient` geçmiyor) — bu beklenen bir ara durum, Task 3'te düzelecek.

- [ ] **Step 5: Commit**

```bash
git add server/app.ts server/app.test.ts
git commit -m "feat: add /api/geocode and /api/reverse-geocode routes"
```

---

### Task 3: Sunucu Bağlama (server/index.ts)

**Files:**
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: `createGeocodingClient` (Task 1, `./geocoding`)

- [ ] **Step 1: server/index.ts'i güncelle**

`import { createScheduler } from './scheduler';` satırının hemen altına ekle:

```ts
import { createGeocodingClient } from './geocoding';
```

`const app = createApp({ store, vapidPublicKey: VAPID_PUBLIC_KEY });` satırını şununla değiştir:

```ts
const app = createApp({
  store,
  vapidPublicKey: VAPID_PUBLIC_KEY,
  geocodingClient: createGeocodingClient(),
});
```

- [ ] **Step 2: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 3: Manuel doğrulama**

Run: `npx tsx server/index.ts` (VAPID anahtarları `.env`'de zaten mevcut olmalı, önceki özellikten)

Başka bir terminalde:
```bash
curl -s "http://localhost:8787/api/geocode?q=Ankara"
```
Expected: `{"results":[...]}` — gerçek Nominatim sonuçları (internet bağlantısı gerekir).

```bash
curl -s "http://localhost:8787/api/reverse-geocode?lat=41.0264&lng=29.0152"
```
Expected: `{"location":{...}}` — Üsküdar/İstanbul civarı bir sonuç.

Sunucuyu durdur (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add server/index.ts
git commit -m "feat: wire real Nominatim geocoding client into server"
```

---

### Task 4: LocationModal'a Canlı Arama ve GPS Çözümü Ekle

**Files:**
- Modify: `src/components/LocationModal.tsx` (tüm dosya değiştirilir)

**Interfaces:** Yok (bu son task, önceki hiçbir task'ın exportuna bağımlı değil — doğrudan `/api/geocode` ve `/api/reverse-geocode`'u `fetch` ile çağırır, Vite proxy'si zaten kurulu).

- [ ] **Step 1: src/components/LocationModal.tsx dosyasının tamamını şu içerikle değiştir**

```tsx
import React, { useEffect, useState } from 'react';
import { Search, MapPin, Navigation, Check, X } from 'lucide-react';
import { LocationItem } from '../types';
import { POPULAR_LOCATIONS } from '../data/locations';

interface LocationModalProps {
  currentLocation: LocationItem;
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (loc: LocationItem) => void;
}

type SearchStatus = 'idle' | 'loading' | 'error' | 'no-results';

export const LocationModal: React.FC<LocationModalProps> = ({
  currentLocation,
  isOpen,
  onClose,
  onSelectLocation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationItem[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');

  useEffect(() => {
    const trimmed = searchQuery.trim();

    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchStatus('idle');
      return;
    }

    setSearchStatus('loading');

    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          setSearchStatus('error');
          setSearchResults([]);
          return;
        }
        const data = await res.json();
        const results: LocationItem[] = data.results ?? [];
        setSearchResults(results);
        setSearchStatus(results.length === 0 ? 'no-results' : 'idle');
      } catch {
        setSearchStatus('error');
        setSearchResults([]);
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  if (!isOpen) return null;

  const filteredLocations = POPULAR_LOCATIONS.filter((loc) => {
    const q = searchQuery.toLowerCase();
    return (
      loc.cityName.toLowerCase().includes(q) ||
      loc.districtName.toLowerCase().includes(q) ||
      loc.country.toLowerCase().includes(q)
    );
  });

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      alert('Cihazınızda GPS desteği bulunamadı.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const fallbackLoc: LocationItem = {
          id: `gps-${Date.now()}`,
          cityName: 'Mevcut Konum',
          districtName: 'GPS Tespiti',
          country: 'Türkiye',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        try {
          const res = await fetch(
            `/api/reverse-geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.location) {
              setIsLocating(false);
              onSelectLocation({ ...data.location, id: `gps-${Date.now()}` });
              onClose();
              return;
            }
          }
        } catch {
          // Ağ hatası: sessizce sabit etikete düş
        }

        setIsLocating(false);
        onSelectLocation(fallbackLoc);
        onClose();
      },
      () => {
        setIsLocating(false);
        alert('GPS konumu alınamadı. Varsayılan listeden şehir seçebilirsiniz.');
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-[#D6A84D]/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#D6A84D]" />
            <h3 className="font-serif-title font-bold text-base text-[var(--ink)]">
              Şehir ve Konum Seçimi
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--mist)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 bg-[var(--paper)]">
          <button
            onClick={handleUseGPS}
            disabled={isLocating}
            className="w-full py-2.5 px-4 rounded-xl bg-[#D6A84D] hover:bg-[#c4983e] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Navigation className="w-4 h-4 animate-spin-slow" />
            <span>
              {isLocating ? 'Konum Alınıyor...' : 'Mevcut Konumumu Otomatik Kullan (GPS)'}
            </span>
          </button>

          <div className="relative">
            <Search className="w-4 h-4 text-[var(--mist)] absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Şehir veya ilçe ara (örn: Üsküdar, Ankara, Mekke...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[var(--card-bg)] border border-[#D6A84D]/20 rounded-xl text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#D6A84D]"
            />
          </div>
        </div>

        {searchQuery.trim().length >= 2 && (
          <div className="px-3 pt-1 pb-2 border-b border-[#D6A84D]/10">
            <div className="text-[10px] font-bold text-[var(--mist)] uppercase tracking-wider px-1 mb-1">
              Arama Sonuçları
            </div>

            {searchStatus === 'loading' && (
              <div className="text-center py-4 text-xs text-[var(--mist)]">Aranıyor...</div>
            )}

            {searchStatus === 'error' && (
              <div className="text-center py-4 text-xs text-red-500">
                Arama başarısız, tekrar deneyin.
              </div>
            )}

            {searchStatus === 'no-results' && (
              <div className="text-center py-4 text-xs text-[var(--mist)]">Sonuç bulunamadı.</div>
            )}

            {searchStatus === 'idle' && searchResults.length > 0 && (
              <div className="space-y-1">
                {searchResults.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => {
                      onSelectLocation(loc);
                      onClose();
                    }}
                    className="w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer hover:bg-[var(--paper)] text-[var(--ink)]"
                  >
                    <div>
                      <div className="text-sm font-bold font-serif-title">
                        {loc.districtName || loc.cityName}
                        {loc.districtName && (
                          <span className="font-sans text-xs opacity-75 font-normal ml-1">
                            , {loc.cityName}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--mist)]">{loc.country}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-1 divide-y divide-gray-100 dark:divide-gray-800/40">
          {filteredLocations.map((loc) => {
            const isSelected = loc.id === currentLocation.id;

            return (
              <button
                key={loc.id}
                onClick={() => {
                  onSelectLocation(loc);
                  onClose();
                }}
                className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#D6A84D]/15 text-[#D6A84D]'
                    : 'hover:bg-[var(--paper)] text-[var(--ink)]'
                }`}
              >
                <div>
                  <div className="text-sm font-bold font-serif-title">
                    {loc.districtName}
                    <span className="font-sans text-xs opacity-75 font-normal ml-1">
                      , {loc.cityName}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--mist)]">{loc.country}</div>
                </div>

                {isSelected && <Check className="w-4 h-4 text-[#D6A84D]" />}
              </button>
            );
          })}

          {filteredLocations.length === 0 && (
            <div className="text-center py-8 text-xs text-[var(--mist)]">
              Aramanıza uygun şehir bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 3: Manuel doğrulama**

Run: `npm run dev:all`, tarayıcıda `http://localhost:3000` aç, üstteki konum butonuna tıkla, arama kutusuna "Berlin" yaz.
Expected: 400ms sonra "Arama Sonuçları" bölümünde gerçek Nominatim sonuçları belirir; sonuca tıklayınca konum güncellenir ve modal kapanır.

- [ ] **Step 4: Commit**

```bash
git add src/components/LocationModal.tsx
git commit -m "feat: add live Nominatim search and GPS reverse-geocoding to location modal"
```
