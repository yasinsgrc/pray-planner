import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNotificationPayload } from './pushPayload';
import { PRAYER_LABELS, PrayerName } from './prayerLabels';

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

// Güneş is not a namaz vakti — it's the moment the Sabah namazı window
// closes and İşrâk kerahet begins. "Hayırlı namazlar" / "Vakti Girdi" /
// "hazırlık için hatırlatma" all frame it as a prayer to perform, which is
// religiously wrong (design-refresh-v3 Faz 20 madde 1). Every OTHER prayer
// key is a real namaz vakti start, so it must keep the prayer-invitation
// wording — this test guards against overcorrecting those too.
test('buildNotificationPayload does not invite prayer for gunes (kerahet start, not a namaz vakti)', () => {
  const payload = buildNotificationPayload('gunes');
  assert.ok(payload);
  // "Sabah Namazı" is legitimate context (which prayer's window just
  // closed) — the bug was framing Güneş itself as a vakti to pray AT
  // ("Vakti Girdi" / "Hayırlı namazlar"), not the mere word "namaz".
  assert.doesNotMatch(payload!.title, /vakti girdi/i);
  assert.doesNotMatch(payload!.body, /hayırlı namazlar/i);
});

test('buildNotificationPayload gunes early-warning does not invite prayer preparation either', () => {
  const payload = buildNotificationPayload('gunes-early:15');
  assert.ok(payload);
  assert.doesNotMatch(payload!.body, /hazırlık|abdest/i);
});

test('every real namaz vakti (all but gunes) still invites prayer', () => {
  for (const name of ['imsak', 'ogle', 'ikindi', 'aksam', 'yatsi']) {
    const payload = buildNotificationPayload(name);
    assert.ok(payload, `expected a payload for "${name}"`);
    assert.equal(payload!.title, `${PRAYER_LABELS[name as PrayerName]} Vakti Girdi`);
    assert.equal(payload!.body, 'Hayırlı namazlar.');

    const earlyPayload = buildNotificationPayload(`${name}-early:15`);
    assert.ok(earlyPayload, `expected an early-warning payload for "${name}"`);
    assert.equal(earlyPayload!.body, 'Abdest ve hazırlık için hatırlatma.');
  }
});
