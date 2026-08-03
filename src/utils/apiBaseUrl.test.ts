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
