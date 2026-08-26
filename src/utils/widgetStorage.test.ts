import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeWidgetPayload, buildEsmaPayload } from './widgetStorage';
import { DEFAULT_LOCATION } from '../data/locations';
import { defaultAppSettings } from './appSettingsStorage';
import { ESMA_UL_HUSNA } from '../data/esmaulHusna';

// Faz 23 Commit 3 — yük yalnızca native platformda yazılır. node:test
// ortamında isNativePlatform() her zaman false döner (platform.test.ts'te
// doğrulandı), bu yüzden writeWidgetPayload burada @capacitor/preferences'a
// hiç dokunmadan sessizce no-op olarak dönmeli — dokunsaydı, DOM/native
// bridge'i olmayan bu ortamda fırlatırdı.
test('writeWidgetPayload is a no-op that resolves without throwing outside native platform', async () => {
  const settings = defaultAppSettings();
  await assert.doesNotReject(() => writeWidgetPayload(settings));
});

test('writeWidgetPayload accepts a location + calculationMethod-bearing settings object', async () => {
  const settings = { ...defaultAppSettings(), location: DEFAULT_LOCATION };
  await assert.doesNotReject(() => writeWidgetPayload(settings, new Date('2026-08-07T10:00:00Z')));
});

test('buildEsmaPayload has schemaVersion 1 and one entry per ESMA_UL_HUSNA name', () => {
  const payload = buildEsmaPayload();
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.names.length, ESMA_UL_HUSNA.length);
});

test('buildEsmaPayload names carry arabic/transliteration/meaning straight from ESMA_UL_HUSNA', () => {
  const payload = buildEsmaPayload();
  assert.deepEqual(payload.names[0], ESMA_UL_HUSNA[0]);
});
