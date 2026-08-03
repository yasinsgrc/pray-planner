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
    address.city ??
    address.town ??
    address.county ??
    (result.display_name ?? '').split(',')[0].trim();
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
}

/**
 * Thrown when Nominatim itself signals it's overloaded (429/503) — kept
 * distinguishable from other failures so the route handler can respond
 * with a specific "try the list instead" message rather than a generic
 * error (design-refresh-v3 Faz 6 B1).
 */
export class GeocodingRateLimitedError extends Error {}

const USER_AGENT = 'VAKIT-Namaz-App/1.0 (https://github.com/yasinsgrc/pray-planner)';
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

export function createGeocodingClient(fetchImpl: typeof fetch = fetch): GeocodingClient {
  async function searchLocations(query: string): Promise<LocationItem[]> {
    const url = `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=8&accept-language=tr`;
    const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });

    if (!res.ok) {
      if (res.status === 429 || res.status === 503) {
        throw new GeocodingRateLimitedError(`Nominatim rate limited: ${res.status}`);
      }
      throw new Error(`Nominatim arama başarısız: ${res.status}`);
    }

    const results = (await res.json()) as NominatimResult[];
    return results.map(mapNominatimResultToLocationItem);
  }

  return { searchLocations };
}

const CACHE_MAX_ENTRIES = 500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 1100;

interface CacheEntry {
  results: LocationItem[];
  expiresAt: number;
}

/**
 * Wraps a raw GeocodingClient with an in-memory result cache and a global
 * outbound request queue, so this server never exceeds Nominatim's usage
 * policy (max 1 request/second, cache identical queries) regardless of how
 * many concurrent users are searching (design-refresh-v3 Faz 6 B1). Kept
 * separate from createGeocodingClient so geocoding.test.ts can keep testing
 * the raw client's request/response mapping without eating the artificial
 * delay — only server/index.ts wires this wrapper around the real client.
 */
export function withCacheAndRateLimit(
  client: GeocodingClient,
  opts: { now?: () => number; sleep?: (ms: number) => Promise<void> } = {}
): GeocodingClient {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const cache = new Map<string, CacheEntry>();
  let lastRequestAt = 0;
  let queue: Promise<unknown> = Promise.resolve();

  function cacheGet(key: string): LocationItem[] | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < now()) {
      cache.delete(key);
      return undefined;
    }
    // Re-insert to move this key to the end of Map's iteration order (LRU).
    cache.delete(key);
    cache.set(key, entry);
    return entry.results;
  }

  function cacheSet(key: string, results: LocationItem[]): void {
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
    cache.set(key, { results, expiresAt: now() + CACHE_TTL_MS });
  }

  function schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
      const elapsed = now() - lastRequestAt;
      if (elapsed < MIN_REQUEST_INTERVAL_MS) {
        await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
      }
      lastRequestAt = now();
      return fn();
    });
    // A rejected call must not permanently wedge the queue for callers
    // behind it — swallow here, the real rejection still reaches `run`'s
    // own caller below.
    queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  return {
    async searchLocations(query: string): Promise<LocationItem[]> {
      const key = query.trim().toLowerCase();
      const cached = cacheGet(key);
      if (cached) return cached;
      const results = await schedule(() => client.searchLocations(query));
      cacheSet(key, results);
      return results;
    },
  };
}
