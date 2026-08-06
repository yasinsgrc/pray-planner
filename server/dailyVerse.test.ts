import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDailyVerseService } from './dailyVerse';

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function makeApiBody(surahNumber: number, ayah: number, turkish: string) {
  return { data: { surah: { number: surahNumber }, verse: { ayah, translations: { turkish } } } };
}

test('fetches and maps a verse with the correct Turkish surah name', async () => {
  const fakeFetch = (async () => fakeResponse(makeApiBody(39, 59, 'Test meal metni'))) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch, now: () => new Date('2026-08-01') });
  const result = await service.getVerseOfTheDay();
  assert.equal(result.verse, 'Test meal metni');
  assert.equal(result.verseRef, 'Zümer Suresi, 59. Ayet');
});

test('maps surah number 1 to Fâtiha correctly', async () => {
  const fakeFetch = (async () => fakeResponse(makeApiBody(1, 1, 'Test'))) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch });
  const result = await service.getVerseOfTheDay();
  assert.equal(result.verseRef, 'Fâtiha Suresi, 1. Ayet');
});

test('maps surah number 114 to Nâs correctly', async () => {
  const fakeFetch = (async () => fakeResponse(makeApiBody(114, 6, 'Test'))) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch });
  const result = await service.getVerseOfTheDay();
  assert.equal(result.verseRef, 'Nâs Suresi, 6. Ayet');
});

test('caches the verse for the same calendar day, only calling fetch once', async () => {
  let callCount = 0;
  const fakeFetch = (async () => {
    callCount++;
    return fakeResponse(makeApiBody(1, 1, 'İlk çağrı'));
  }) as typeof fetch;
  const fixedNow = () => new Date('2026-08-01T10:00:00Z');
  const service = createDailyVerseService({ fetchImpl: fakeFetch, now: fixedNow });

  await service.getVerseOfTheDay();
  await service.getVerseOfTheDay();

  assert.equal(callCount, 1);
});

test('refetches when the calendar day changes', async () => {
  let callCount = 0;
  let current = new Date('2026-08-01T10:00:00Z');
  const fakeFetch = (async () => {
    callCount++;
    return fakeResponse(makeApiBody(1, 1, 'Metin'));
  }) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch, now: () => current });

  await service.getVerseOfTheDay();
  current = new Date('2026-08-02T10:00:00Z');
  await service.getVerseOfTheDay();

  assert.equal(callCount, 2);
});

test('throws when the API responds with a non-ok status', async () => {
  const fakeFetch = (async () => fakeResponse({}, false, 500)) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch });
  await assert.rejects(() => service.getVerseOfTheDay());
});

test('decodes HTML entities in the API-provided translation (design-refresh-v3 Faz 20 madde 2)', async () => {
  const fakeFetch = (async () =>
    fakeResponse(makeApiBody(1, 1, 'O, &quot;Rabbimiz&quot; dedi ve Allah&#39;a sığındı.'))) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch });
  const result = await service.getVerseOfTheDay();
  assert.equal(result.verse, 'O, "Rabbimiz" dedi ve Allah\'a sığındı.');
});

test('throws when the Turkish translation is missing', async () => {
  const fakeFetch = (async () =>
    fakeResponse({ data: { surah: { number: 1 }, verse: { ayah: 1, translations: {} } } })) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch });
  await assert.rejects(() => service.getVerseOfTheDay());
});
