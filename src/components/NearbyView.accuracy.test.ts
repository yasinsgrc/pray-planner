import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// NearbyView is not portal-rendered but still can't be mounted under
// node:test's SSR-only environment (no DOM, no geolocation API) — same
// limitation as BottomSheet.keyboardLayout.test.ts. This asserts the
// source declarations directly; the real on-device behavior needs a real
// device or npm run visual.
const source = readFileSync(path.join(import.meta.dirname, 'NearbyView.tsx'), 'utf8');

test('imports the shared low-accuracy threshold from gpsAccuracy instead of redefining it', () => {
  assert.match(source, /import\s*\{[^}]*LOW_ACCURACY_THRESHOLD_M[^}]*\}\s*from\s*['"]\.\.\/utils\/gpsAccuracy['"]/);
  assert.doesNotMatch(
    source,
    /const\s+LOW_ACCURACY_THRESHOLD_M\s*=/,
    'the threshold must be imported, not redefined locally'
  );
});

test('geolocation requests a fresh, high-accuracy fix instead of accepting a 60s WiFi-cached fix', () => {
  assert.match(
    source,
    /GEOLOCATION_OPTIONS: PositionOptions = \{ enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 \}/
  );
});

test('coords state carries GPS accuracy alongside lat/lng', () => {
  assert.match(source, /useState<\{ lat: number; lng: number; accuracy: number \} \| null>/);
  assert.match(source, /accuracy: pos\.coords\.accuracy/);
});

test('renders a non-blocking low-accuracy warning banner above the places list', () => {
  assert.match(source, /coords\.accuracy > LOW_ACCURACY_THRESHOLD_M/);
  assert.match(source, /Konum hassasiyeti düşük/);
  assert.match(source, /mesafeler yaklaşıktır/);
});

test('the places list still renders regardless of the accuracy warning (no blocking)', () => {
  assert.match(source, /places\.map\(\(place\) => \(/);
});
