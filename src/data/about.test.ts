import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABOUT_VERIFIED_FACTS, ABOUT_USER_SECTIONS } from './about';

test('ABOUT_VERIFIED_FACTS has no empty bodies', () => {
  assert.ok(ABOUT_VERIFIED_FACTS.length > 0);
  for (const fact of ABOUT_VERIFIED_FACTS) {
    assert.ok(fact.title.length > 0);
    assert.ok(fact.body.length > 0, `expected a non-empty body for "${fact.title}"`);
  }
});

// design-refresh-v3 Faz 24 Commit 1 — the sections are now filled in;
// AboutModal.tsx falls back to a hard-to-miss red warning whenever body is
// null or empty, so neither may ever ship again.
test('ABOUT_USER_SECTIONS has no null or empty bodies', () => {
  assert.ok(ABOUT_USER_SECTIONS.length > 0);
  for (const section of ABOUT_USER_SECTIONS) {
    assert.notEqual(section.body, null, `expected "${section.title}" to be filled in`);
    assert.ok(section.body && section.body.length > 0, `expected a non-empty body for "${section.title}"`);
  }
});

// Guards against an unfilled "<<SLOT>>" shipping to production the way the
// old placeholder texts did (design-refresh-v3 Faz 23 denetim düzeltmesi 2).
test('no ABOUT_USER_SECTIONS body contains an unfilled "<<...>>" slot', () => {
  for (const section of ABOUT_USER_SECTIONS) {
    assert.ok(!section.body?.includes('<<'), `expected "${section.title}" to have no "<<" slot marker`);
    assert.ok(!section.body?.includes('>>'), `expected "${section.title}" to have no ">>" slot marker`);
  }
});

test('the İletişim section body contains a contact email', () => {
  const contact = ABOUT_USER_SECTIONS.find((s) => s.title === 'İletişim');
  assert.ok(contact, 'expected an "İletişim" section to exist');
  assert.match(contact!.body ?? '', /@/);
});
