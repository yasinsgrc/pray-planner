import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStoredAppSettings, defaultAppSettings } from './appSettingsStorage';

// design-refresh-v3 Faz 19: "Vakit Düzeltmesi" (±10min manual correction)
// was removed entirely — measured that adhan's Turkey method already
// matches Diyanet's own published times to within 1 minute, so the
// adjustment only ever gave users a way to make times WRONG. This is the
// regression test for the silent migration: a user who saved a nonzero
// correction under the old build must not carry it forward after the
// update, silently or otherwise — the field must be fully gone from what
// gets loaded (and therefore from what gets saved back).
test('parseStoredAppSettings strips a legacy prayerAdjustments field entirely', () => {
  const legacyRaw = JSON.stringify({
    themeMode: 'auto',
    calculationMethod: 'Diyanet',
    prayerAdjustments: { imsak: 5, gunes: 0, ogle: -3, ikindi: 0, aksam: 2, yatsi: -1 },
  });

  const result = parseStoredAppSettings(legacyRaw);

  assert.equal(
    'prayerAdjustments' in result,
    false,
    'a legacy prayerAdjustments value must not survive into the loaded settings'
  );
});

test('parseStoredAppSettings returns defaults (also with no prayerAdjustments) when nothing is stored', () => {
  const result = parseStoredAppSettings(null);
  assert.equal('prayerAdjustments' in result, false);
  assert.deepEqual(result, defaultAppSettings());
});

test('parseStoredAppSettings falls back to defaults on corrupted JSON', () => {
  const result = parseStoredAppSettings('{ not valid json ][');
  assert.deepEqual(result, defaultAppSettings());
});

test('parseStoredAppSettings still migrates legacy SoundMode values alongside the prayerAdjustments strip', () => {
  const legacyRaw = JSON.stringify({
    notifications: { imsak: 'ezan', gunes: 'sessiz', ogle: 'tini', ikindi: 'ilahi1', aksam: 'ilahi2', yatsi: 'ilahi3' },
    prayerAdjustments: { imsak: 10 },
  });

  const result = parseStoredAppSettings(legacyRaw);

  assert.equal(result.notifications.imsak, 'bildirim');
  assert.equal(result.notifications.gunes, 'sessiz');
  assert.equal('prayerAdjustments' in result, false);
});

test('parseStoredAppSettings preserves an unrelated field like location across the migration', () => {
  const legacyRaw = JSON.stringify({
    location: { id: 'x', cityName: 'İzmir', districtName: 'Konak', country: 'Türkiye', lat: 38.4, lng: 27.1 },
    prayerAdjustments: { imsak: -5 },
  });

  const result = parseStoredAppSettings(legacyRaw);

  assert.equal(result.location.cityName, 'İzmir');
  assert.equal('prayerAdjustments' in result, false);
});

// design-refresh-v3 Faz 19: MWL/ISNA/Egypt/Karachi/Makkah calculation
// method options were removed — Diyanet only, since the app's users are in
// Turkey and any other method produces times that disagree with the local
// mosque. A user who had picked one of the removed methods under an older
// build must be silently migrated back to Diyanet, not left on a value the
// UI can no longer even display or change.
test('parseStoredAppSettings migrates a non-Diyanet calculationMethod to Diyanet', () => {
  for (const legacyMethod of ['MWL', 'ISNA', 'Egypt', 'Karachi', 'Makkah']) {
    const result = parseStoredAppSettings(JSON.stringify({ calculationMethod: legacyMethod }));
    assert.equal(result.calculationMethod, 'Diyanet', `expected ${legacyMethod} to migrate to Diyanet`);
  }
});

test('parseStoredAppSettings keeps calculationMethod as Diyanet when already Diyanet', () => {
  const result = parseStoredAppSettings(JSON.stringify({ calculationMethod: 'Diyanet' }));
  assert.equal(result.calculationMethod, 'Diyanet');
});

test('parseStoredAppSettings defaults to Diyanet when calculationMethod is absent or garbage', () => {
  assert.equal(parseStoredAppSettings(JSON.stringify({})).calculationMethod, 'Diyanet');
  assert.equal(parseStoredAppSettings(JSON.stringify({ calculationMethod: 12345 })).calculationMethod, 'Diyanet');
});

// design-refresh-v3 Faz 22 Commit 4: the "bildirimler kapalı" home-screen
// hint must not reappear once dismissed, even across a reload — but an
// older build's saved settings never had this field at all, and it must
// not crash or silently re-show the hint from a corrupted value either.
test('parseStoredAppSettings defaults pushHintDismissedAt to null when the field is absent (legacy record)', () => {
  const result = parseStoredAppSettings(JSON.stringify({ themeMode: 'auto' }));
  assert.equal(result.pushHintDismissedAt, null);
});

test('parseStoredAppSettings falls back to null when pushHintDismissedAt is a corrupted type', () => {
  assert.equal(parseStoredAppSettings(JSON.stringify({ pushHintDismissedAt: 'evet' })).pushHintDismissedAt, null);
  assert.equal(parseStoredAppSettings(JSON.stringify({ pushHintDismissedAt: {} })).pushHintDismissedAt, null);
});

test('parseStoredAppSettings preserves a valid pushHintDismissedAt value', () => {
  const result = parseStoredAppSettings(JSON.stringify({ pushHintDismissedAt: 1754500000000 }));
  assert.equal(result.pushHintDismissedAt, 1754500000000);
});
