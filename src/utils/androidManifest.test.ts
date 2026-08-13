import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Faz 26 Commit 1 — Capacitor 8'in BridgeWebChromeClient.onGeolocationPermissionsShowPrompt
// metodu COARSE + FINE konum izni istiyor; Manifest'te tanımsızsa Android
// isteği anında reddediyor ve GPS butonu native'de her zaman başarısız oluyor.
const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf-8');

test('AndroidManifest.xml declares ACCESS_COARSE_LOCATION', () => {
  assert.equal(manifest.includes('android.permission.ACCESS_COARSE_LOCATION'), true);
});

test('AndroidManifest.xml declares ACCESS_FINE_LOCATION', () => {
  assert.equal(manifest.includes('android.permission.ACCESS_FINE_LOCATION'), true);
});

test('AndroidManifest.xml still declares INTERNET (regression guard)', () => {
  assert.equal(manifest.includes('android.permission.INTERNET'), true);
});

test('AndroidManifest.xml does not declare ACCESS_BACKGROUND_LOCATION (Play policy risk)', () => {
  assert.equal(manifest.includes('android.permission.ACCESS_BACKGROUND_LOCATION'), false);
});
