import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESET_DHIKRS,
  getCounterFor,
  pruneOldZikirLogEntries,
  addZikirCount,
  getDayTotal,
  type ZikirmatikState,
  type ZikirLog,
} from './zikirmatikStorage';

// loadZikirmatikState/saveZikirmatikState/loadZikirLog/saveZikirLog touch
// `localStorage`, which isn't available under node:test — the migration and
// log-arithmetic logic they wrap is tested directly here instead.

test('PRESET_DHIKRS has 5 entries matching the app-wide dhikr set', () => {
  assert.equal(PRESET_DHIKRS.length, 5);
  assert.equal(PRESET_DHIKRS[0].title, 'Subhânallah');
});

test('getCounterFor returns a zeroed counter for an index with no recorded progress', () => {
  const state: ZikirmatikState = { selectedDhikrIndex: 0, counters: {} };
  assert.deepEqual(getCounterFor(state, 2), { counter: 0, lap: 0 });
});

test('getCounterFor returns the stored counter for a known index', () => {
  const state: ZikirmatikState = { selectedDhikrIndex: 1, counters: { 1: { counter: 7, lap: 2 } } };
  assert.deepEqual(getCounterFor(state, 1), { counter: 7, lap: 2 });
});

test('addZikirCount creates a new day entry when none exists yet', () => {
  const log: ZikirLog = {};
  const updated = addZikirCount(log, '2026-08-02', 'Subhânallah', 1);
  assert.deepEqual(updated, { '2026-08-02': { Subhânallah: 1 } });
});

test('addZikirCount accumulates repeated taps for the same dhikr on the same day', () => {
  let log: ZikirLog = {};
  log = addZikirCount(log, '2026-08-02', 'Subhânallah', 1);
  log = addZikirCount(log, '2026-08-02', 'Subhânallah', 1);
  log = addZikirCount(log, '2026-08-02', 'Elhamdulillâh', 1);
  assert.deepEqual(log['2026-08-02'], { Subhânallah: 2, Elhamdulillâh: 1 });
});

test('addZikirCount never mutates the log it was given (pure, safe inside a setState updater)', () => {
  const log: ZikirLog = { '2026-08-01': { Subhânallah: 5 } };
  const updated = addZikirCount(log, '2026-08-01', 'Subhânallah', 1);
  assert.equal(log['2026-08-01'].Subhânallah, 5);
  assert.equal(updated['2026-08-01'].Subhânallah, 6);
});

test('getDayTotal sums every dhikr logged on a day', () => {
  const log: ZikirLog = { '2026-08-02': { Subhânallah: 132, Elhamdulillâh: 10 } };
  assert.equal(getDayTotal(log, '2026-08-02'), 142);
});

test('getDayTotal returns 0 for a day with no log entry', () => {
  assert.equal(getDayTotal({}, '2026-08-02'), 0);
});

test('pruneOldZikirLogEntries drops entries older than 30 days but keeps the boundary day', () => {
  const log: ZikirLog = {
    '2026-07-03': { Subhânallah: 1 }, // 30 days before 2026-08-02 -> kept
    '2026-07-02': { Subhânallah: 1 }, // 31 days before -> dropped
    '2026-08-02': { Subhânallah: 1 },
  };
  const pruned = pruneOldZikirLogEntries(log, '2026-08-02');
  assert.deepEqual(Object.keys(pruned).sort(), ['2026-07-03', '2026-08-02']);
});
