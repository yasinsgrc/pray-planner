import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeWidgetPayload } from './widgetStorage';
import { DEFAULT_LOCATION } from '../data/locations';
import { defaultAppSettings } from './appSettingsStorage';

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
