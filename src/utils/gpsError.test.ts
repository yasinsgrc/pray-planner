import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getGpsErrorMessage } from './gpsError';

// Faz 26 Commit 1 — Capacitor'ün native izin akışı web'den farklı: kullanıcı
// native'de tarayıcı ayarı değil telefon/sistem ayarı görmeli.
test('getGpsErrorMessage: PERMISSION_DENIED on native points to phone/system settings, not "Tarayıcı"', () => {
  const msg = getGpsErrorMessage(1, true);
  assert.equal(msg.includes('Tarayıcı'), false);
  assert.equal(msg.includes('ayarlar'), true);
});

test('getGpsErrorMessage: PERMISSION_DENIED on web keeps the existing "Tarayıcı" wording', () => {
  const msg = getGpsErrorMessage(1, false);
  assert.equal(msg.includes('Tarayıcı'), true);
});

test('getGpsErrorMessage: TIMEOUT gives the same message on native and web', () => {
  assert.equal(getGpsErrorMessage(3, true), getGpsErrorMessage(3, false));
});

test('getGpsErrorMessage: TIMEOUT message mentions zaman aşımı', () => {
  assert.equal(getGpsErrorMessage(3, false).includes('zaman aşımı'), true);
});

test('getGpsErrorMessage: POSITION_UNAVAILABLE falls back to the generic message', () => {
  assert.equal(getGpsErrorMessage(2, true), getGpsErrorMessage(2, false));
  assert.equal(getGpsErrorMessage(2, false).length > 0, true);
});

test('getGpsErrorMessage: unknown code falls back to the generic message', () => {
  assert.equal(getGpsErrorMessage(99, true), getGpsErrorMessage(99, false));
});

test('getGpsErrorMessage: never returns an empty string for any known code/platform combo', () => {
  for (const code of [1, 2, 3, 99]) {
    for (const isNative of [true, false]) {
      assert.equal(getGpsErrorMessage(code, isNative).length > 0, true);
    }
  }
});
