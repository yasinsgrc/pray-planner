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
