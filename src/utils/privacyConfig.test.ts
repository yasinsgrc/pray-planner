import { test } from 'node:test';
import assert from 'node:assert/strict';
// Tests isPrivacyConfigured (a pure, import.meta.env-free module) rather than
// privacyConfig.ts directly — the latter's whole module body reads
// import.meta.env at import time, which only exists inside Vite's own
// runtime, not a plain node:test process (same reasoning as
// apiBaseUrl.test.ts testing joinApiUrl from ./urlJoin instead of
// apiBaseUrl.ts). Real coverage for privacyConfig.ts's own env wiring comes
// from npm run visual (a real browser).
import { isPrivacyConfigured, type PrivacyFields } from './privacyFieldsConfigured';

const ALL_CONFIGURED: PrivacyFields = {
  entityName: 'VAKİT',
  address: 'Darıca/Kocaeli',
  contactEmail: 'yyasinsgrc@gmail.com',
  hostingProvider: 'Netlify',
};

test('isPrivacyConfigured is true when all four fields are defined', () => {
  assert.equal(isPrivacyConfigured(ALL_CONFIGURED), true);
});

test('isPrivacyConfigured is false when entityName is missing', () => {
  assert.equal(isPrivacyConfigured({ ...ALL_CONFIGURED, entityName: undefined }), false);
});

test('isPrivacyConfigured is false when address is missing', () => {
  assert.equal(isPrivacyConfigured({ ...ALL_CONFIGURED, address: undefined }), false);
});

test('isPrivacyConfigured is false when contactEmail is missing', () => {
  assert.equal(isPrivacyConfigured({ ...ALL_CONFIGURED, contactEmail: undefined }), false);
});

test('isPrivacyConfigured is false when hostingProvider is missing', () => {
  assert.equal(isPrivacyConfigured({ ...ALL_CONFIGURED, hostingProvider: undefined }), false);
});
