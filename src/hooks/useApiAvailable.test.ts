import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkApiAvailable } from './useApiAvailable';

function fakeResponse(opts: { status: number; contentType: string; body: unknown }): Response {
  return {
    ok: opts.status >= 200 && opts.status < 300,
    status: opts.status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? opts.contentType : null) },
    json: async () => opts.body,
  } as unknown as Response;
}

function withFetch(impl: typeof fetch, run: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

test('checkApiAvailable returns true for a real vakit-api /health response', async () => {
  await withFetch(
    (async () =>
      fakeResponse({ status: 200, contentType: 'application/json; charset=utf-8', body: { ok: true, service: 'vakit-api' } })) as typeof fetch,
    async () => {
      assert.equal(await checkApiAvailable(), true);
    }
  );
});

test('checkApiAvailable returns false for a static host SPA fallback (200 + HTML) — the exact false positive this guards against', async () => {
  await withFetch(
    (async () => fakeResponse({ status: 200, contentType: 'text/html; charset=utf-8', body: {} })) as typeof fetch,
    async () => {
      assert.equal(await checkApiAvailable(), false);
    }
  );
});

test('checkApiAvailable returns false when the JSON body has no matching service field', async () => {
  await withFetch(
    (async () =>
      fakeResponse({ status: 200, contentType: 'application/json', body: { ok: true, service: 'something-else' } })) as typeof fetch,
    async () => {
      assert.equal(await checkApiAvailable(), false);
    }
  );
});

test('checkApiAvailable returns false for a non-2xx status', async () => {
  await withFetch(
    (async () => fakeResponse({ status: 500, contentType: 'application/json', body: {} })) as typeof fetch,
    async () => {
      assert.equal(await checkApiAvailable(), false);
    }
  );
});

test('checkApiAvailable returns false when fetch throws (network error, offline, timeout abort)', async () => {
  await withFetch(
    (async () => {
      throw new Error('network down');
    }) as typeof fetch,
    async () => {
      assert.equal(await checkApiAvailable(), false);
    }
  );
});
