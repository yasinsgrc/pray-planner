import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.join(import.meta.dirname, '..', '..');

interface PackageJson {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

function readPackageJson(): PackageJson {
  const raw = readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8');
  return JSON.parse(raw) as PackageJson;
}

// design-refresh-v3 Faz 23 denetim düzeltmesi — build/test araçları
// dependencies altına düşerse npm audit --omit=dev bunları prod açığı
// olarak raporlar (nanoid, @tailwindcss/vite -> vite -> postcss zinciri
// üzerinden tam olarak bu oldu). Bu test sınıflandırmayı kalıcı olarak
// doğrular.
test('build/test-only tooling is not listed under dependencies', () => {
  const { dependencies } = readPackageJson();
  const buildTools = [
    'vite',
    '@vitejs/plugin-react',
    '@tailwindcss/vite',
    'tailwindcss',
    'typescript',
    'tsx',
    'playwright-core',
    'sharp',
    'license-checker',
    '@capacitor/cli',
  ];
  for (const name of buildTools) {
    assert.ok(!(name in dependencies), `expected "${name}" to not be in dependencies (it is a build/test tool)`);
  }
});

test('runtime packages are listed under dependencies', () => {
  const { dependencies } = readPackageJson();
  const runtimePackages = [
    '@capacitor/core',
    '@capacitor/android',
    '@capacitor/local-notifications',
    '@capacitor/preferences',
    'adhan',
    'react',
    'react-dom',
  ];
  for (const name of runtimePackages) {
    assert.ok(name in dependencies, `expected "${name}" to be in dependencies (it runs at runtime)`);
  }
});

test('no package is listed in both dependencies and devDependencies', () => {
  const { dependencies, devDependencies } = readPackageJson();
  const overlap = Object.keys(dependencies).filter((name) => name in devDependencies);
  assert.deepEqual(overlap, []);
});
