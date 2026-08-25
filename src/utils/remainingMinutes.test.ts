import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRemainingMinutes } from './remainingMinutes';

// Halka saniye hassasiyetiyle sayarken, dakikaya yuvarlayan her yer aynı
// formülü kullanmalı — yoksa aynı an için iki farklı sayı gösterilir (ör.
// halka "00:07:26" derken bir kart "8 dk" der). Tek kaynak: aşağı yuvarla
// (namaz için güvenli taraf — az süre göstermek, fazla değil).

test('7 dk 26 sn kalınca 7 döner (aşağı yuvarlama, yukarı değil)', () => {
  assert.equal(formatRemainingMinutes(446_000), 7);
});

test('tam 60 sn kalınca 1 döner', () => {
  assert.equal(formatRemainingMinutes(60_000), 1);
});

test('59.999 sn kalınca 0 döner (bir sonraki dakikaya yuvarlanmaz)', () => {
  assert.equal(formatRemainingMinutes(59_999), 0);
});

test('0 ms kalınca 0 döner', () => {
  assert.equal(formatRemainingMinutes(0), 0);
});

test('negatif kalan süre 0a clamp edilir', () => {
  assert.equal(formatRemainingMinutes(-5_000), 0);
});
