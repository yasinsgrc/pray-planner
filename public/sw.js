// VAKİT service worker — precaches the app shell so prayer times (already
// computed entirely on-device from lat/lng via adhan; no network call is
// involved) remain reachable with no connection (design-refresh-v3 Faz 4
// F1). Deliberately does NOT cache /api/* — geocoding and the daily-verse
// endpoint must stay fresh, and the app already falls back to its static
// content pool silently when they fail.

const CACHE_PREFIX = 'vakit-shell-';

// Fetched once per SW execution context (service workers can be woken up
// fresh for any single event, so this can't be set inside one handler and
// read from another — every handler awaits the same promise instead).
const manifestPromise = fetch('/precache-manifest.json')
  .then((res) => res.json())
  .catch(() => null);

async function getCacheName() {
  const manifest = await manifestPromise;
  return manifest ? CACHE_PREFIX + manifest.version : null;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const manifest = await manifestPromise;
      if (!manifest) return; // offline on first install with no cache yet — nothing to do
      const cache = await caches.open(CACHE_PREFIX + manifest.version);
      // addAll fails the whole install if any single file 404s — precache
      // shell files individually instead so one missing/renamed file can't
      // silently prevent the entire app from ever going offline-ready.
      await Promise.all(
        manifest.urls.map((url) =>
          cache.add(url).catch((err) => console.warn('[sw] precache miss', url, err))
        )
      );
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheName = await getCacheName();
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== cacheName)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// The update-available banner (App.tsx) sends this once the user taps
// "Yenile" — the app never force-activates a new version out from under
// someone mid-use.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function networkFirst(request) {
  const cacheName = await getCacheName();
  try {
    const response = await fetch(request);
    if (cacheName && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = cacheName ? await caches.match(request, { cacheName }) : null;
    return cached || (await caches.match('/')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cacheName = await getCacheName();
  const cached = cacheName ? await caches.match(request, { cacheName }) : null;
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (cacheName && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // don't intercept cross-origin requests
  if (url.pathname.startsWith('/api/')) return; // always fresh — never cached

  const isNavigation =
    request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');

  event.respondWith(isNavigation ? networkFirst(request) : cacheFirst(request));
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'VAKİT',
    body: 'Namaz vakti bildirimi',
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (err) {
    // Bozuk payload — varsayılan metinlerle devam et.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
