import { test } from 'node:test';
import assert from 'node:assert/strict';
import config from '../../capacitor.config';

// Faz 27.17 — com.vakit Play Console'da başka bir geliştirici tarafından
// alınmış; applicationId com.app.vakit'e taşınıyor. appId burada yanlışlıkla
// eski değere geri dönerse (örn. bir merge çakışmasında) yayın engellenir.
test('capacitor.config.ts appId is com.app.vakit', () => {
  assert.equal(config.appId, 'com.app.vakit');
});
