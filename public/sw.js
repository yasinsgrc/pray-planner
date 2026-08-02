// VAKİT service worker — precaches the app shell so prayer times (already
// computed entirely on-device from lat/lng via adhan; no network call is
// involved) remain reachable with no connection (design-refresh-v3 Faz 4
// F1). Deliberately does NOT cache /api/* — geocoding and the daily-verse
// endpoint must stay fresh, and the app already falls back to its static
// content pool silently when they fail.

const CACHE_PREFIX = 'vakit-shell-';

// Replaced in-place by scripts/generate-sw-precache.mjs, which runs after
// `vite build` and edits dist/sw.js directly — this file (served as-is by
// `npm run dev`) intentionally keeps its version at 'dev' and its list
// empty. A previous version of this file instead fetched a separate
// precache-manifest.json at startup to learn its own cache name — that
// fetch fails while offline, so the SW could never even find its own
// cache after a cold start with no connection (design-refresh-v3 Faz 5
// F1, measured: fonts requestfailed, document.fonts read "error", despite
// both files genuinely sitting in Cache Storage under a name the worker
// no longer knew). Knowing the cache name must cost zero network requests.
const PRECACHE_VERSION = 'dev';
const PRECACHE_URLS = [];

const CACHE_NAME = CACHE_PREFIX + PRECACHE_VERSION;
const HAS_PRECACHE = PRECACHE_VERSION !== 'dev' && PRECACHE_URLS.length > 0;

self.addEventListener('install', (event) => {
  if (!HAS_PRECACHE) return; // dev build — nothing to precache, no-op
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Precache shell files individually (not cache.addAll, which fails
      // the whole install on a single 404) so one missing/renamed file
      // can't silently prevent the entire app from ever going
      // offline-ready. Failures are batched into one warning instead of
      // one console.warn per URL.
      const failed = [];
      await Promise.all(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => failed.push(url)))
      );
      if (failed.length > 0) {
        console.warn(`[sw] ${failed.length} precache miss(es): ${failed.join(', ')}`);
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))
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

// Never conditioned on anything derived from a network call — CACHE_NAME
// is a build-time constant now, but this still falls back to an unscoped
// caches.match(request) (searches every cache this origin owns) rather
// than skipping the cache outright, in case HAS_PRECACHE is ever false
// for a reason other than a genuine dev build (design-refresh-v3 Faz 5 F1).
//
// ignoreVary: true is required, not optional. Font resources are always
// fetched in CORS mode per the CSS Fonts spec (even same-origin), so a
// font's real load-time request carries an Origin header the SW's own
// install-time cache.add() fetch did not. The server sends Vary: Origin
// on every response, so a Vary-aware match silently misses a genuinely
// cached, byte-identical entry and falls through to network — which fails
// while offline (design-refresh-v3 Faz 5 F1, measured: font requests
// net::ERR_FAILED + document.fonts "error" despite the exact URL sitting
// in Cache Storage). This is a same-origin static app shell we build and
// serve ourselves, so content negotiation via Vary has no meaning here.
async function matchAnyCache(request) {
  if (HAS_PRECACHE) {
    const scoped = await caches.match(request, { cacheName: CACHE_NAME, ignoreVary: true });
    if (scoped) return scoped;
  }
  return caches.match(request, { ignoreVary: true });
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (HAS_PRECACHE && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await matchAnyCache(request);
    return cached || (await caches.match('/', { ignoreVary: true })) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await matchAnyCache(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (HAS_PRECACHE && response.ok) {
      const cache = await caches.open(CACHE_NAME);
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
