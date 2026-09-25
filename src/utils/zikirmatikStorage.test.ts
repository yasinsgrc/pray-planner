import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESET_DHIKRS,
  getCounterFor,
  pruneOldZikirLogEntries,
  addZikirCount,
  getDayTotal,
  rollOverZikirmatikDay,
  loadZikirmatikState,
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

test('rollOverZikirmatikDay keeps counters on the same day', () => {
  const state: ZikirmatikState = { selectedDhikrIndex: 2, counters: { 2: { counter: 10, lap: 1 } }, dayKey: '2026-09-26' };
  assert.equal(rollOverZikirmatikDay(state, '2026-09-26'), state);
});

test('rollOverZikirmatikDay zeroes every counter on a new day but keeps the selected dhikr', () => {
  const state: ZikirmatikState = { selectedDhikrIndex: 2, counters: { 2: { counter: 10, lap: 1 } }, dayKey: '2026-09-25' };
  const next = rollOverZikirmatikDay(state, '2026-09-26');
  assert.equal(next.selectedDhikrIndex, 2);
  assert.equal(next.dayKey, '2026-09-26');
  assert.deepEqual(getCounterFor(next, 2), { counter: 0, lap: 0 });
});

test('rollOverZikirmatikDay adopts a state saved without dayKey instead of wiping it', () => {
  const state: ZikirmatikState = { selectedDhikrIndex: 0, counters: { 0: { counter: 7, lap: 0 } } };
  const next = rollOverZikirmatikDay(state, '2026-09-26');
  assert.equal(next.dayKey, '2026-09-26');
  assert.deepEqual(getCounterFor(next, 0), { counter: 7, lap: 0 });
});

test('loadZikirmatikState keeps dayKey and falls back to dhikr 0 for an out-of-range index', () => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  try {
    store.set('vakit_zikirmatik_state_v2', JSON.stringify({ selectedDhikrIndex: 9, counters: {}, dayKey: '2026-09-26' }));
    const loaded = loadZikirmatikState();
    assert.equal(loaded.selectedDhikrIndex, 0);
    assert.equal(loaded.dayKey, '2026-09-26');
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
