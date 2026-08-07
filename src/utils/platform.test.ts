import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNativePlatform } from './platform';

// Faz 23 Commit 1 — birden fazla yer (pushClient.ts'in SW kaydı, App.tsx'in
// güncelleme şeridi) davranışı web/native arasında ayırmak zorunda. Bu tek
// saf fonksiyon, Capacitor global'i hiç yokken bile (node:test ortamı,
// düz bir tarayıcı sekmesi) çökmeden false dönmeli.
test('isNativePlatform returns false when there is no Capacitor global (plain node:test / web without Capacitor)', () => {
  assert.equal(isNativePlatform(), false);
});

test('isNativePlatform does not throw', () => {
  assert.doesNotThrow(() => isNativePlatform());
});
