import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryPushStore, createPostgresPushStore } from './pushStore';
import type { PgPoolLike, PushStore } from './pushStore';

const SUB_A = { endpoint: 'https://push.example.com/a', p256dh: 'p256dh-a', auth: 'auth-a' };
const SUB_B = { endpoint: 'https://push.example.com/b', p256dh: 'p256dh-b', auth: 'auth-b' };

function minutesFromNow(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * 60000);
}

/**
 * Both PushStore implementations must satisfy identical behavior — this
 * suite runs the same cases against each rather than duplicating them, so
 * a bug in either backend (or a behavioral drift between them) shows up
 * regardless of which one production ends up using.
 */
function definePushStoreContractTests(name: string, createStore: () => Promise<PushStore>) {
  test(`[${name}] claimDueSchedules returns a schedule entry once its fire_at has passed`, async () => {
    const store = await createStore();
    const now = new Date('2026-08-10T12:00:00.000Z');
    await store.upsertSubscriptionAndSchedule(SUB_A, [{ fireAt: minutesFromNow(now, -1), prayerKey: 'ogle' }]);

    const due = await store.claimDueSchedules(now);

    assert.equal(due.length, 1);
    assert.equal(due[0].prayerKey, 'ogle');
    assert.equal(due[0].endpoint, SUB_A.endpoint);
  });

  test(`[${name}] claimDueSchedules does not return entries whose fire_at is still in the future`, async () => {
    const store = await createStore();
    const now = new Date('2026-08-10T12:00:00.000Z');
    await store.upsertSubscriptionAndSchedule(SUB_A, [{ fireAt: minutesFromNow(now, 5), prayerKey: 'ikindi' }]);

    const due = await store.claimDueSchedules(now);

    assert.equal(due.length, 0);
  });

  // The actual "double-send" bug this exists to prevent: the cron tick
  // firing twice (e.g. a slow tick overlapping the next interval) must
  // never let two callers both believe they own the same schedule row.
  test(`[${name}] two concurrent claimDueSchedules calls never return the same row`, async () => {
    const store = await createStore();
    const now = new Date('2026-08-10T12:00:00.000Z');
    await store.upsertSubscriptionAndSchedule(SUB_A, [
      { fireAt: minutesFromNow(now, -1), prayerKey: 'imsak' },
      { fireAt: minutesFromNow(now, -1), prayerKey: 'ogle' },
      { fireAt: minutesFromNow(now, -1), prayerKey: 'ikindi' },
    ]);

    const [first, second] = await Promise.all([store.claimDueSchedules(now), store.claimDueSchedules(now)]);

    const allIds = [...first, ...second].map((d) => d.scheduleId);
    assert.equal(allIds.length, 3, 'all 3 rows must be claimed exactly once, across both calls combined');
    assert.equal(new Set(allIds).size, 3, 'no schedule id may appear in both result sets');
  });

  test(`[${name}] a claimed row is never returned again on a later tick`, async () => {
    const store = await createStore();
    const now = new Date('2026-08-10T12:00:00.000Z');
    await store.upsertSubscriptionAndSchedule(SUB_A, [{ fireAt: minutesFromNow(now, -1), prayerKey: 'aksam' }]);

    const firstTick = await store.claimDueSchedules(now);
    const secondTick = await store.claimDueSchedules(minutesFromNow(now, 1));

    assert.equal(firstTick.length, 1);
    assert.equal(secondTick.length, 0);
  });

  test(`[${name}] removeSubscription deletes the subscription and all of its schedule rows`, async () => {
    const store = await createStore();
    const now = new Date('2026-08-10T12:00:00.000Z');
    await store.upsertSubscriptionAndSchedule(SUB_A, [{ fireAt: minutesFromNow(now, -1), prayerKey: 'yatsi' }]);
    await store.upsertSubscriptionAndSchedule(SUB_B, [{ fireAt: minutesFromNow(now, -1), prayerKey: 'yatsi' }]);

    await store.removeSubscription(SUB_A.endpoint);
    const due = await store.claimDueSchedules(now);

    assert.equal(due.length, 1, 'only SUB_B\'s schedule should remain');
    assert.equal(due[0].endpoint, SUB_B.endpoint);
  });

  // The whole reason /api/push/schedule exists: a changed location or
  // calculation method must not leave the OLD schedule active alongside
  // the new one.
  test(`[${name}] re-subscribing the same endpoint replaces its schedule entirely, not merges`, async () => {
    const store = await createStore();
    const now = new Date('2026-08-10T12:00:00.000Z');
    await store.upsertSubscriptionAndSchedule(SUB_A, [{ fireAt: minutesFromNow(now, -1), prayerKey: 'ogle-old-city' }]);
    await store.upsertSubscriptionAndSchedule(SUB_A, [{ fireAt: minutesFromNow(now, -1), prayerKey: 'ogle-new-city' }]);

    const due = await store.claimDueSchedules(now);

    assert.equal(due.length, 1);
    assert.equal(due[0].prayerKey, 'ogle-new-city');
  });

  test(`[${name}] cleanupOldSchedules removes entries older than the cutoff`, async () => {
    const store = await createStore();
    const now = new Date('2026-08-10T12:00:00.000Z');
    await store.upsertSubscriptionAndSchedule(SUB_A, [
      { fireAt: minutesFromNow(now, -60 * 24 * 2), prayerKey: 'old' }, // 2 days ago
      { fireAt: minutesFromNow(now, -5), prayerKey: 'recent' },
    ]);

    const removed = await store.cleanupOldSchedules(minutesFromNow(now, -60 * 24));

    assert.equal(removed, 1);
    const due = await store.claimDueSchedules(now);
    assert.equal(due.length, 1);
    assert.equal(due[0].prayerKey, 'recent');
  });

  test(`[${name}] checkHealth resolves true for a working store`, async () => {
    const store = await createStore();
    assert.equal(await store.checkHealth(), true);
  });

  test(`[${name}] listSubscriptions returns every current subscription's credentials`, async () => {
    const store = await createStore();
    await store.upsertSubscriptionAndSchedule(SUB_A, []);
    await store.upsertSubscriptionAndSchedule(SUB_B, []);

    const subs = await store.listSubscriptions();

    assert.equal(subs.length, 2);
    assert.ok(subs.some((s) => s.endpoint === SUB_A.endpoint && s.p256dh === SUB_A.p256dh));
    assert.ok(subs.some((s) => s.endpoint === SUB_B.endpoint && s.p256dh === SUB_B.p256dh));
  });
}

definePushStoreContractTests('in-memory', async () => createInMemoryPushStore());

/**
 * Minimal in-memory stand-in for `pg`'s Pool — enough to exercise the SQL
 * createPostgresPushStore issues, without a real database in the test run.
 * Mirrors subscriptionStore.test.ts's existing fake-pool convention.
 */
function createFakePgPool(): PgPoolLike {
  let nextSubId = 1;
  let nextScheduleId = 1;
  const subsByEndpoint = new Map<string, { id: number; endpoint: string; p256dh: string; auth: string }>();
  const subsById = new Map<number, { id: number; endpoint: string; p256dh: string; auth: string }>();
  const schedules: Array<{ id: number; subscription_id: number; fire_at: string; prayer_key: string; sent_at: string | null }> = [];

  return {
    async query(text: string, params: unknown[] = []) {
      const sql = text.trim().toUpperCase();

      if (sql.startsWith('CREATE TABLE') || sql.includes('CREATE TABLE IF NOT EXISTS')) {
        return { rows: [] };
      }
      if (sql.startsWith('SELECT 1')) {
        return { rows: [{ '?column?': 1 }] };
      }
      if (sql.startsWith('INSERT INTO PUSH_SUBSCRIPTIONS')) {
        const [endpoint, p256dh, auth] = params as [string, string, string];
        let sub = subsByEndpoint.get(endpoint);
        if (sub) {
          sub.p256dh = p256dh;
          sub.auth = auth;
        } else {
          sub = { id: nextSubId++, endpoint, p256dh, auth };
          subsByEndpoint.set(endpoint, sub);
          subsById.set(sub.id, sub);
        }
        return { rows: [{ id: sub.id }] };
      }
      if (sql.startsWith('DELETE FROM PUSH_SCHEDULES WHERE SUBSCRIPTION_ID')) {
        const [subscriptionId] = params as [number];
        for (let i = schedules.length - 1; i >= 0; i--) {
          if (schedules[i].subscription_id === subscriptionId) schedules.splice(i, 1);
        }
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO PUSH_SCHEDULES')) {
        const [subscriptionId, fireAt, prayerKey] = params as [number, string, string];
        schedules.push({ id: nextScheduleId++, subscription_id: subscriptionId, fire_at: fireAt, prayer_key: prayerKey, sent_at: null });
        return { rows: [] };
      }
      if (sql.startsWith('DELETE FROM PUSH_SUBSCRIPTIONS')) {
        const [endpoint] = params as [string];
        const sub = subsByEndpoint.get(endpoint);
        if (sub) {
          subsByEndpoint.delete(endpoint);
          subsById.delete(sub.id);
          for (let i = schedules.length - 1; i >= 0; i--) {
            if (schedules[i].subscription_id === sub.id) schedules.splice(i, 1);
          }
        }
        return { rows: [] };
      }
      if (sql.startsWith('UPDATE PUSH_SCHEDULES')) {
        const [nowIso] = params as [string];
        const now = new Date(nowIso).getTime();
        const claimed = [];
        for (const row of schedules) {
          if (row.sent_at === null && new Date(row.fire_at).getTime() <= now) {
            row.sent_at = nowIso;
            claimed.push({ id: row.id, subscription_id: row.subscription_id, fire_at: row.fire_at, prayer_key: row.prayer_key });
          }
        }
        return { rows: claimed };
      }
      if (sql.startsWith('SELECT ID, ENDPOINT, P256DH, AUTH')) {
        const [ids] = params as [number[]];
        const rows = ids.map((id) => subsById.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
        return { rows };
      }
      if (sql.startsWith('DELETE FROM PUSH_SCHEDULES WHERE FIRE_AT')) {
        const [cutoffIso] = params as [string];
        const cutoff = new Date(cutoffIso).getTime();
        const removedRows = [];
        for (let i = schedules.length - 1; i >= 0; i--) {
          if (new Date(schedules[i].fire_at).getTime() < cutoff) {
            removedRows.push({ id: schedules[i].id });
            schedules.splice(i, 1);
          }
        }
        return { rows: removedRows };
      }
      if (sql.startsWith('SELECT ENDPOINT, P256DH, AUTH')) {
        return { rows: [...subsByEndpoint.values()] };
      }
      throw new Error(`fake pg pool: unhandled query: ${text}`);
    },
  };
}

definePushStoreContractTests('postgres (fake pool)', async () => createPostgresPushStore(createFakePgPool()));

test('postgres store: creates its tables on construction', async () => {
  const queries: string[] = [];
  const pool: PgPoolLike = {
    async query(text) {
      queries.push(text.trim());
      return { rows: [] };
    },
  };

  await createPostgresPushStore(pool);

  assert.ok(queries[0].toUpperCase().includes('CREATE TABLE'));
});
