import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { attachStaticApp } from './static';

async function withStaticServer(run: (baseUrl: string) => Promise<void>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-static-'));
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'index.html'), '<html><body>index</body></html>');
  writeFileSync(path.join(dir, 'sw.js'), '// sw');
  writeFileSync(path.join(dir, 'assets', 'index-ABC123.js'), '// hashed asset');

  const app = express();
  attachStaticApp(app, dir);
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
}

test('serves index.html at / with a no-cache header', async () => {
  await withStaticServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    assert.ok((await res.text()).includes('index'));
  });
});

test('serves sw.js with a no-cache header', async () => {
  await withStaticServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/sw.js`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
  });
});

test('serves hashed /assets/* files with an immutable long-lived cache header', async () => {
  await withStaticServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/assets/index-ABC123.js`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  });
});

test('falls back to index.html for an unknown non-API route (SPA client routing)', async () => {
  await withStaticServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/some/deep/link`);
    assert.equal(res.status, 200);
    assert.ok((await res.text()).includes('index'));
  });
});

test('returns a 404 JSON response for an unmatched /api/* route instead of index.html', async () => {
  await withStaticServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'Not found');
  });
});
