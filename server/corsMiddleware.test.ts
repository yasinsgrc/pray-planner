import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createCorsMiddleware } from './corsMiddleware';

const ALLOWED_ORIGIN = 'https://vakit.yasinsigirci.com.tr';

async function withTestApp(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(createCorsMiddleware(ALLOWED_ORIGIN));
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  app.post('/ping', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('allows the configured origin and echoes it back', async () => {
  await withTestApp(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/ping`, { headers: { Origin: ALLOWED_ORIGIN } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
  });
});

test('rejects a preflight request from a different origin', async () => {
  await withTestApp(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/ping`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(res.status, 403);
  });
});

test('does not set an allow-origin header for a mismatched origin', async () => {
  await withTestApp(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/ping`, { headers: { Origin: 'https://evil.example.com' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });
});

test('answers a valid preflight with 204 and the allowed methods/headers', async () => {
  await withTestApp(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/ping`, {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
    assert.ok(res.headers.get('access-control-allow-methods')?.includes('POST'));
  });
});

test('a request with no Origin header (non-browser client) passes through untouched', async () => {
  await withTestApp(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/ping`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });
});
