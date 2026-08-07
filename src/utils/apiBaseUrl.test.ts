import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinApiUrl } from './urlJoin';

// Tests joinApiUrl (a pure, import.meta.env-free module) rather than
// apiUrl/API_BASE_URL directly — the latter live in apiBaseUrl.ts, whose
// whole module body reads import.meta.env at import time, which only
// exists inside Vite's own runtime (browser or vite dev server), not a
// plain node:test process. Matches this codebase's existing convention:
// privacyConfig.ts/supportConfig.ts read import.meta.env directly and have
// no unit tests either; real coverage for that part comes from
// npm run visual (a real browser).
test('joinApiUrl returns a relative path when the base is empty (single-origin mode)', () => {
  assert.equal(joinApiUrl('', '/health'), '/health');
  assert.equal(joinApiUrl('', '/api/push/subscribe'), '/api/push/subscribe');
});

test('joinApiUrl prefixes the path with the configured base (cross-origin mode)', () => {
  assert.equal(joinApiUrl('https://api.example.com', '/health'), 'https://api.example.com/health');
});

test('joinApiUrl adds a leading slash if the caller forgot one', () => {
  assert.equal(joinApiUrl('', 'health'), '/health');
  assert.equal(joinApiUrl('https://api.example.com', 'health'), 'https://api.example.com/health');
});

// design-refresh-v3 Faz 23 Commit 1 — apiBaseUrl.ts's own API_BASE_URL
// already strips a trailing slash before ever calling joinApiUrl, but
// joinApiUrl is the pure, directly-tested unit here (see file header
// comment), and native builds will soon make VITE_API_BASE_URL mandatory
// rather than optional — a base value is no longer purely developer-typed
// with the leisure to always remember the trailing slash. joinApiUrl
// should not depend on its caller having already normalized the base.
test('joinApiUrl never produces a double slash even if the base already ends in one', () => {
  assert.equal(joinApiUrl('https://api.example.com/', '/health'), 'https://api.example.com/health');
  assert.equal(joinApiUrl('https://api.example.com/', 'health'), 'https://api.example.com/health');
});
