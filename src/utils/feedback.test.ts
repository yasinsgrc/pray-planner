import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeedbackDiagnosticsText, buildFeedbackBody, buildFeedbackMailtoUrl } from './feedback';

const DIAGNOSTICS = {
  appVersion: '0.1.0',
  userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0',
  locationSource: 'GPS' as const,
};

test('buildFeedbackDiagnosticsText includes app version, user agent, and location method', () => {
  const text = buildFeedbackDiagnosticsText(DIAGNOSTICS);
  assert.match(text, /0\.1\.0/);
  assert.match(text, /Android 14/);
  assert.match(text, /GPS/);
});

// The one hard constraint: no city, no coordinates, ever — only whether
// the location came from GPS or manual selection (design-refresh-v3
// Faz 20 madde 5, explicit user requirement).
test('buildFeedbackDiagnosticsText never mentions a city or coordinates', () => {
  const text = buildFeedbackDiagnosticsText({ ...DIAGNOSTICS, locationSource: 'Elle seçim' });
  assert.doesNotMatch(text, /İstanbul|Üsküdar|Ankara/);
  assert.doesNotMatch(text, /\d+\.\d+,\s*\d+\.\d+/);
  assert.match(text, /Elle seçim/);
});

test('buildFeedbackBody places the user message before the diagnostics block, both present', () => {
  const body = buildFeedbackBody('Vakitler bir dakika yanlış görünüyor.', DIAGNOSTICS);
  const messageIndex = body.indexOf('Vakitler bir dakika yanlış görünüyor.');
  const diagnosticsIndex = body.indexOf('0.1.0');
  assert.ok(messageIndex >= 0);
  assert.ok(diagnosticsIndex > messageIndex);
});

test('buildFeedbackBody works with an empty user message (diagnostics still present)', () => {
  const body = buildFeedbackBody('', DIAGNOSTICS);
  assert.match(body, /0\.1\.0/);
});

test('buildFeedbackMailtoUrl percent-encodes the subject and body, not "+" for spaces', () => {
  const url = buildFeedbackMailtoUrl('destek@example.com', 'VAKİT geri bildirim', 'iki kelime');
  assert.ok(url.startsWith('mailto:destek@example.com?'));
  assert.match(url, /subject=/);
  assert.match(url, /body=/);
  assert.doesNotMatch(url, /iki\+kelime/);
  assert.match(url, /iki%20kelime/);
});
