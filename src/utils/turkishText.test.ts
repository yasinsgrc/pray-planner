import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTurkish } from './turkishText';

test('normalizeTurkish folds case variants of the same word to the same result', () => {
  assert.equal(normalizeTurkish('gebze'), normalizeTurkish('Gebze'));
  assert.equal(normalizeTurkish('Gebze'), normalizeTurkish('GEBZE'));
});

test('normalizeTurkish folds Turkish-specific letters onto their unaccented form', () => {
  assert.equal(normalizeTurkish('Şırnak'), 'sirnak');
  assert.equal(normalizeTurkish('İzmir'), 'izmir');
  assert.equal(normalizeTurkish('Çanakkale'), 'canakkale');
  assert.equal(normalizeTurkish('Öğle'), 'ogle');
  assert.equal(normalizeTurkish('Üsküdar'), 'uskudar');
});

test('normalizeTurkish leaves already-plain ASCII text unaffected besides casing', () => {
  assert.equal(normalizeTurkish('Ankara'), 'ankara');
});
