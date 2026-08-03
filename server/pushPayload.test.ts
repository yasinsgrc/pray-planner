import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNotificationPayload } from './pushPayload';

test('buildNotificationPayload builds a main-prayer title', () => {
  const payload = buildNotificationPayload('ogle');
  assert.equal(payload?.title, 'Öğle Vakti Girdi');
  assert.equal(payload?.body, 'Hayırlı namazlar.');
});

test('buildNotificationPayload builds an early-warning title with the embedded minutes', () => {
  const payload = buildNotificationPayload('ikindi-early:15');
  assert.equal(payload?.title, 'İkindi Vaktine 15 Dakika Kaldı');
  assert.equal(payload?.body, 'Abdest ve hazırlık için hatırlatma.');
});

test('buildNotificationPayload returns null for an unrecognized prayer name', () => {
  assert.equal(buildNotificationPayload('nonexistent'), null);
});

test('buildNotificationPayload returns null for an unrecognized early-warning prayer name', () => {
  assert.equal(buildNotificationPayload('nonexistent-early:15'), null);
});

test('buildNotificationPayload returns null for a malformed key', () => {
  assert.equal(buildNotificationPayload('ogle-early'), null);
  assert.equal(buildNotificationPayload(''), null);
});

test('buildNotificationPayload covers every prayer name', () => {
  for (const name of ['imsak', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi']) {
    assert.ok(buildNotificationPayload(name), `expected a payload for "${name}"`);
    assert.ok(buildNotificationPayload(`${name}-early:10`), `expected a payload for "${name}-early:10"`);
  }
});
