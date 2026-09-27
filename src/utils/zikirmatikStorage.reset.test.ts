import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESET_DHIKRS,
  subtractZikirCount,
  getResetAmount,
  getZikirHistory,
  getZikirTrend,
  type ZikirLog,
} from './zikirmatikStorage';

test('getResetAmount = tamamlanan turlar × hedef + turdaki sayı', () => {
  // Subhânallah hedef 33: 2 tur + 5 = 71
  assert.equal(getResetAmount(0, { counter: 5, lap: 2 }), 71);
  // Lâ ilâhe illallâh hedef 100: 0 tur + 7 = 7
  assert.equal(getResetAmount(3, { counter: 7, lap: 0 }), 7);
  assert.equal(PRESET_DHIKRS[3].target, 100);
});

test('subtractZikirCount sıfırlanan sayıyı günün kaydından düşer', () => {
  const log: ZikirLog = { '2026-09-27': { Subhânallah: 71, Elhamdulillâh: 10 } };
  assert.deepEqual(subtractZikirCount(log, '2026-09-27', 'Subhânallah', 40), {
    '2026-09-27': { Subhânallah: 31, Elhamdulillâh: 10 },
  });
});

test('subtractZikirCount sıfıra inen zikri listeden tamamen kaldırır', () => {
  const log: ZikirLog = { '2026-09-27': { Subhânallah: 71, Elhamdulillâh: 10 } };
  assert.deepEqual(subtractZikirCount(log, '2026-09-27', 'Subhânallah', 71), {
    '2026-09-27': { Elhamdulillâh: 10 },
  });
});

test('subtractZikirCount günde başka zikir kalmazsa günü de kaldırır', () => {
  const log: ZikirLog = { '2026-09-26': { Tekbir: 3 }, '2026-09-27': { Subhânallah: 5 } };
  assert.deepEqual(subtractZikirCount(log, '2026-09-27', 'Subhânallah', 5), { '2026-09-26': { Tekbir: 3 } });
});

test('subtractZikirCount kayıttakinden fazlasını düşünce eksiye inmez (göç öncesi sayaç)', () => {
  const log: ZikirLog = { '2026-09-27': { Subhânallah: 4, Elhamdulillâh: 1 } };
  assert.deepEqual(subtractZikirCount(log, '2026-09-27', 'Subhânallah', 50), {
    '2026-09-27': { Elhamdulillâh: 1 },
  });
});

test('subtractZikirCount başka günlere ve kayıtsız zikre dokunmaz', () => {
  const log: ZikirLog = { '2026-09-26': { Subhânallah: 9 } };
  assert.deepEqual(subtractZikirCount(log, '2026-09-27', 'Subhânallah', 5), { '2026-09-26': { Subhânallah: 9 } });
  assert.deepEqual(subtractZikirCount(log, '2026-09-26', 'Tekbir', 5), { '2026-09-26': { Subhânallah: 9 } });
});

test('sıfırla sonrası geçmiş yalnızca kalan sayıyı gösterir', () => {
  const log: ZikirLog = { '2026-09-27': { Subhânallah: 71, Elhamdulillâh: 10 } };
  const after = subtractZikirCount(log, '2026-09-27', 'Subhânallah', 71);
  assert.deepEqual(getZikirHistory(after), [
    { dateKey: '2026-09-27', total: 10, entries: [['Elhamdulillâh', 10]] },
  ]);
});

test('getZikirTrend son N günü eskiden yeniye, boş günler 0 olarak döner', () => {
  const log: ZikirLog = {
    '2026-09-25': { Subhânallah: 33 },
    '2026-09-27': { Subhânallah: 10, Elhamdulillâh: 5 },
    '2026-08-01': { Subhânallah: 999 },
  };
  assert.deepEqual(getZikirTrend(log, '2026-09-27', 4), [
    { dateKey: '2026-09-24', total: 0 },
    { dateKey: '2026-09-25', total: 33 },
    { dateKey: '2026-09-26', total: 0 },
    { dateKey: '2026-09-27', total: 15 },
  ]);
});

test('getZikirTrend ay ve yıl sınırını doğru geçer', () => {
  assert.deepEqual(
    getZikirTrend({}, '2027-01-01', 3).map((d) => d.dateKey),
    ['2026-12-30', '2026-12-31', '2027-01-01'],
  );
});
