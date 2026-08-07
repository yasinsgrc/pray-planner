import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAndroidVersionCode } from './androidVersionCode';

// Faz 23 Commit 1 — android/app/build.gradle'ın versionCode'u elle
// yazılmaz, package.json'daki semver'den türetilir (scripts/sync-android-
// version.mjs). Google Play, bir sonraki yüklemenin versionCode'unun bir
// öncekinden büyük olmasını zorunlu kılar; bu yüzden semver arttıkça
// versionCode'un da her zaman artması kritik bir davranıştır.
test('computeAndroidVersionCode: 0.1.0 -> 100', () => {
  assert.equal(computeAndroidVersionCode('0.1.0'), 100);
});

test('computeAndroidVersionCode: 1.0.0 -> 10000', () => {
  assert.equal(computeAndroidVersionCode('1.0.0'), 10000);
});

test('computeAndroidVersionCode: 1.2.3 -> 10203', () => {
  assert.equal(computeAndroidVersionCode('1.2.3'), 10203);
});

test('computeAndroidVersionCode is strictly increasing across increasing semvers', () => {
  const pairs: [string, string][] = [
    ['0.1.0', '0.1.1'],
    ['0.1.9', '0.2.0'],
    ['0.9.99', '1.0.0'],
    ['1.0.0', '1.0.1'],
    ['1.4.9', '1.5.0'],
  ];
  for (const [lower, higher] of pairs) {
    assert.ok(
      computeAndroidVersionCode(higher) > computeAndroidVersionCode(lower),
      `${higher} should produce a larger versionCode than ${lower}`
    );
  }
});

test('computeAndroidVersionCode throws on a malformed semver instead of silently producing a wrong code', () => {
  assert.throws(() => computeAndroidVersionCode('not-a-version'));
});
