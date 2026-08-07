// package.json'daki "version" tek kaynak — android/app/build.gradle'ın
// versionCode/versionName'i elle senkronize edilmez (design-refresh-v3
// Faz 23 Commit 1). Türetme mantığı src/utils/androidVersionCode.ts'te,
// node:test ile ayrıca test ediliyor; bu betik yalnızca dosyaya yazar.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { computeAndroidVersionCode } from '../src/utils/androidVersionCode.ts';

const rootDir = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const versionCode = computeAndroidVersionCode(version);

const buildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
const original = readFileSync(buildGradlePath, 'utf8');

const updated = original
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);

if (updated === original) {
  throw new Error('sync-android-version: versionCode/versionName pattern not found in build.gradle — check for upstream format changes.');
}

writeFileSync(buildGradlePath, updated);
console.log(`android/app/build.gradle synced: versionName=${version} versionCode=${versionCode}`);
