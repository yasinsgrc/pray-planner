import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createRateLimiter } from './rateLimiter';

async function withTestApp(limiterOpts: { windowMs: number; max: number }, run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.get('/limited', createRateLimiter(limiterOpts), (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('allows requests up to the configured max within the window', async () => {
  await withTestApp({ windowMs: 60000, max: 3 }, async (baseUrl) => {
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/limited`);
      assert.equal(res.status, 200, `request ${i + 1} should succeed`);
    }
  });
});

test('rejects requests beyond the max with 429', async () => {
  await withTestApp({ windowMs: 60000, max: 2 }, async (baseUrl) => {
    await fetch(`${baseUrl}/limited`);
    await fetch(`${baseUrl}/limited`);
    const res = await fetch(`${baseUrl}/limited`);
    assert.equal(res.status, 429);
  });
});

test('resets the count once the window has elapsed', async () => {
  await withTestApp({ windowMs: 50, max: 1 }, async (baseUrl) => {
    const first = await fetch(`${baseUrl}/limited`);
    assert.equal(first.status, 200);
    const second = await fetch(`${baseUrl}/limited`);
    assert.equal(second.status, 429);

    await new Promise((resolve) => setTimeout(resolve, 60));

    const third = await fetch(`${baseUrl}/limited`);
    assert.equal(third.status, 200);
  });
});
