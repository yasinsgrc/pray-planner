import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ABOUT_LIBRARY_LICENSES, ABOUT_VERIFIED_FACTS, ABOUT_USER_SECTIONS } from './about';

const PROJECT_ROOT = path.join(import.meta.dirname, '..', '..');

const PACKAGE_DIR_OVERRIDES: Record<string, string> = {
  'React DOM': 'react-dom',
  '@phosphor-icons/react': '@phosphor-icons/react',
};

function nodeModulesDirFor(displayName: string): string {
  return PACKAGE_DIR_OVERRIDES[displayName] ?? displayName.toLowerCase();
}

// Regression guard (design-refresh-v3 Faz 20 madde 4): if a bundled
// dependency's license ever changes on a future upgrade, or the package no
// longer exists under that name, this fails loudly instead of the About
// screen silently showing stale legal information.
test('every ABOUT_LIBRARY_LICENSES entry matches the actually-installed package license', () => {
  for (const entry of ABOUT_LIBRARY_LICENSES) {
    const dir = nodeModulesDirFor(entry.name);
    const pkgPath = path.join(PROJECT_ROOT, 'node_modules', dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    assert.equal(pkg.license, entry.license, `expected ${entry.name} to be ${entry.license}, found ${pkg.license}`);
  }
});

test('ABOUT_VERIFIED_FACTS has no empty bodies', () => {
  assert.ok(ABOUT_VERIFIED_FACTS.length > 0);
  for (const fact of ABOUT_VERIFIED_FACTS) {
    assert.ok(fact.title.length > 0);
    assert.ok(fact.body.length > 0, `expected a non-empty body for "${fact.title}"`);
  }
});

// Documents the "not filled in yet" contract the UI relies on to show its
// impossible-to-miss placeholder warning (mirrors privacy.ts's unset
// env-var treatment) — if someone ever writes the null check away without
// actually filling the content in, this makes that an explicit failure.
test('ABOUT_USER_SECTIONS starts out unfilled (body is null)', () => {
  assert.ok(ABOUT_USER_SECTIONS.length > 0);
  for (const section of ABOUT_USER_SECTIONS) {
    assert.equal(section.body, null, `expected "${section.title}" to still be a placeholder`);
  }
});
