import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, '.');
const ENTITY_PATTERN = /&(?:quot|amp|apos|lt|gt|nbsp|#\d+|#x[0-9a-fA-F]+);/;

/**
 * Regression guard (design-refresh-v3 Faz 20 madde 2): the actual bug was
 * an external API returning HTML-encoded translation text that nothing
 * ever decoded, not a static data file — but this permanently blocks
 * anyone from ever pasting HTML-escaped text (&quot; etc.) into a static
 * data file in src/data/ either, per the explicit ask to make this check
 * durable rather than a one-off fix.
 */
test('no static data file in src/data contains a raw HTML entity', () => {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  assert.ok(files.length > 0, 'expected to find data files to scan');

  const offenders: string[] = [];
  for (const file of files) {
    const contents = readFileSync(path.join(DATA_DIR, file), 'utf8');
    const match = contents.match(ENTITY_PATTERN);
    if (match) offenders.push(`${file}: "${match[0]}"`);
  }

  assert.deepEqual(offenders, []);
});
