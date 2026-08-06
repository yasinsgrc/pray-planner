import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { GENERATED_LICENSES } from './licenses.generated';
import { EZAN_ATTRIBUTION } from './ezanAttribution';

const PROJECT_ROOT = path.join(import.meta.dirname, '..', '..');

test('GENERATED_LICENSES has an entry for every client-bundled runtime library', () => {
  const names = GENERATED_LICENSES.map((e) => e.name);
  for (const expected of ['react', 'react-dom', 'adhan', 'hijri-converter', 'motion', '@phosphor-icons/react']) {
    assert.ok(names.includes(expected), `expected an entry for "${expected}"`);
  }
});

test('every GENERATED_LICENSES entry has a non-empty license type, version, and full license text', () => {
  assert.ok(GENERATED_LICENSES.length > 0);
  for (const entry of GENERATED_LICENSES) {
    assert.ok(entry.name.length > 0);
    assert.ok(entry.version.length > 0, `expected a version for "${entry.name}"`);
    assert.ok(entry.license.length > 0 && entry.license !== 'UNKNOWN', `expected a resolved license for "${entry.name}"`);
    // MIT requires the text AND copyright notice to travel with the
    // distribution — a bare "MIT" string does not satisfy that.
    assert.ok(entry.licenseText.length > 50, `expected real license text for "${entry.name}"`);
    assert.match(entry.licenseText, /Copyright/i, `expected a copyright notice in "${entry.name}"'s license text`);
  }
});

// CC BY-SA 4.0's attribution requirement has five distinct parts — a name,
// an uploader, where it came from, what license it's under, and whether it
// was changed. Missing any one of them is an incomplete attribution
// (design-refresh-v3 Faz 21 madde 3, explicit user requirement).
test('EZAN_ATTRIBUTION has all five required CC BY-SA 4.0 attribution components', () => {
  assert.ok(EZAN_ATTRIBUTION.workTitle.length > 0);
  assert.ok(EZAN_ATTRIBUTION.uploader.length > 0);
  assert.match(EZAN_ATTRIBUTION.sourceUrl, /^https:\/\/commons\.wikimedia\.org\//);
  assert.match(EZAN_ATTRIBUTION.licenseUrl, /creativecommons\.org\/licenses\/by-sa\/4\.0/);
  assert.ok(EZAN_ATTRIBUTION.modificationStatement.length > 0);
});

// The modification statement claims the file is unmodified and cites a
// SHA1 to back that up — this test recomputes the ACTUAL hash of the
// shipped file and checks it's the one quoted, so if anyone ever swaps in
// a re-encoded or trimmed file, this fails instead of silently shipping a
// false "unmodified" claim.
test('EZAN_ATTRIBUTION\'s cited SHA1 matches the actual shipped audio file', () => {
  const audioPath = path.join(PROJECT_ROOT, 'public', 'sounds', 'ezan.mp3');
  const actualSha1 = createHash('sha1').update(readFileSync(audioPath)).digest('hex');
  assert.match(EZAN_ATTRIBUTION.modificationStatement, new RegExp(actualSha1));
});
