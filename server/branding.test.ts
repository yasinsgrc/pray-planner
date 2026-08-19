import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Turkish uppercase of "vakit" is "VAKİT" (dotted İ, U+0130), which is what the
// launcher name bug actually looked like. This must not be confused with the
// unrelated ASCII "VAKIT" in the VAKIT_TARGET env var name in package.json,
// which is an identifier, not display text, and is intentionally left as-is.
const UPPERCASE_BRAND = 'VAKİT';

test('strings.xml app_name and title_activity_main are exactly "Vakit"', () => {
  const xml = readFileSync(
    path.join(root, 'android/app/src/main/res/values/strings.xml'),
    'utf-8',
  );
  const appName = xml.match(/<string name="app_name">([^<]*)<\/string>/);
  const titleActivity = xml.match(/<string name="title_activity_main">([^<]*)<\/string>/);
  assert.ok(appName, 'app_name string not found');
  assert.ok(titleActivity, 'title_activity_main string not found');
  assert.equal(appName![1], 'Vakit');
  assert.equal(titleActivity![1], 'Vakit');
});

test('no user-visible branding text still reads "VAKİT"', () => {
  const files = [
    'android/app/src/main/res/values/strings.xml',
    'index.html',
    'capacitor.config.ts',
    'public/manifest.webmanifest',
    'package.json',
  ];
  for (const file of files) {
    const content = readFileSync(path.join(root, file), 'utf-8');
    assert.ok(!content.includes(UPPERCASE_BRAND), `${file} still contains "${UPPERCASE_BRAND}"`);
  }
});
