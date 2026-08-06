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
