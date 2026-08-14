import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remainingMinutesCeil } from './remainingMinutes';

// Halka saniye hassasiyetiyle sayarken, dakikaya yuvarlayan her yer
// (kerahet kartı, ekran okuyucu anonsu, vb.) aynı formülü kullanmalı —
// yoksa aynı an için iki farklı sayı gösterilir (ör. halka "00:11:27"
// derken bir kart "11 dk" der). Tek kaynak: yukarı yuvarla, en az 1 dk.

test('11 dk 27 sn kalınca 12 dk döner (yukarı yuvarlama)', () => {
  assert.equal(remainingMinutesCeil(11 * 60 + 27), 12);
});

test('tam 11 dk 00 sn kalınca 11 dk döner', () => {
  assert.equal(remainingMinutesCeil(11 * 60), 11);
});

test('0 dk 30 sn kalınca 1 dk döner (en az 1)', () => {
  assert.equal(remainingMinutesCeil(30), 1);
});
