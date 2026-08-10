import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PUSH_CONSENT_TEXT_WEB, PUSH_CONSENT_TEXT_NATIVE } from './pushConsent';

const DATA_DIR = import.meta.dirname;

function listDataSourceFiles(): string[] {
  return readdirSync(DATA_DIR)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => path.join(DATA_DIR, name));
}

/** Strips /* *\/ block comments, then strips // line comments (tracking
 * quote state per line so a "//" inside a string literal survives). Only
 * string-literal content should reach the caller — comments are allowed to
 * mention "PLACEHOLDER" while explaining why a value is one. */
function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments
    .split('\n')
    .map((line) => {
      let inSingle = false;
      let inDouble = false;
      let inTemplate = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const prevEscaped = line[i - 1] === '\\';
        if (ch === "'" && !inDouble && !inTemplate && !prevEscaped) inSingle = !inSingle;
        else if (ch === '"' && !inSingle && !inTemplate && !prevEscaped) inDouble = !inDouble;
        else if (ch === '`' && !inSingle && !inDouble && !prevEscaped) inTemplate = !inTemplate;
        else if (ch === '/' && line[i + 1] === '/' && !inSingle && !inDouble && !inTemplate) {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');
}

function extractStringLiterals(source: string): string[] {
  const literals: string[] = [];
  const regex = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    literals.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return literals;
}

function allStringLiteralsInDataDir(): { file: string; value: string }[] {
  const results: { file: string; value: string }[] = [];
  for (const filePath of listDataSourceFiles()) {
    const source = stripComments(readFileSync(filePath, 'utf-8'));
    for (const value of extractStringLiterals(source)) {
      results.push({ file: path.basename(filePath), value });
    }
  }
  return results;
}

// design-refresh-v3 Faz 23 denetim düzeltmesi — pushConsent.ts'teki iki
// onay metni yayına "[YER TUTUCU ...]" yazısıyla çıkacaktı, hiçbir test bunu
// yakalamıyordu. Bu test src/data/ altındaki HER string değeri tarar, bu
// yüzden ileride eklenecek metin dosyalarını da otomatik kapsar.
test('no user-visible string in src/data contains a "YER TUTUCU" placeholder marker', () => {
  const offenders = allStringLiteralsInDataDir().filter(({ value }) => value.includes('YER TUTUCU'));
  assert.deepEqual(
    offenders.map((o) => o.file),
    []
  );
});

test('no user-visible string in src/data contains a "PLACEHOLDER" marker', () => {
  const offenders = allStringLiteralsInDataDir().filter(({ value }) => value.includes('PLACEHOLDER'));
  assert.deepEqual(
    offenders.map((o) => o.file),
    []
  );
});

test('no user-visible string in src/data is entirely a "[...]" bracket placeholder', () => {
  const offenders = allStringLiteralsInDataDir().filter(({ value }) => {
    const trimmed = value.trim();
    return trimmed.startsWith('[') && trimmed.endsWith(']');
  });
  assert.deepEqual(
    offenders.map((o) => o.value),
    []
  );
});

test('PUSH_CONSENT_TEXT_WEB and PUSH_CONSENT_TEXT_NATIVE are non-empty and different from each other', () => {
  assert.ok(PUSH_CONSENT_TEXT_WEB.length > 0);
  assert.ok(PUSH_CONSENT_TEXT_NATIVE.length > 0);
  assert.notEqual(PUSH_CONSENT_TEXT_WEB, PUSH_CONSENT_TEXT_NATIVE);
});

// pushClient.ts hiçbir veriyi sunucuya native modda göndermiyor
// (nativeNotifications.ts içinde tek bir fetch çağrısı yok) — native onay
// metni bunun aksini iddia etmemeli.
test('PUSH_CONSENT_TEXT_NATIVE does not claim that data is stored on a server', () => {
  assert.ok(!PUSH_CONSENT_TEXT_NATIVE.includes('saklanır'));
});
