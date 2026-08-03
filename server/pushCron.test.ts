import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPushCron } from './pushCron';
import type { PushStore, DueNotification, ScheduleEntry } from './pushStore';

/**
 * A tiny fake PushStore, built directly against the same real semantics
 * pushStore.test.ts already verified (atomic claim, cascade delete) — this
 * suite is about the CRON's own decisions (send vs. skip-as-stale, cleanup
 * on 404/410), not re-testing the store.
 */
function createFakeStore(): PushStore & { subscriptions: Map<string, boolean>; schedules: Array<{ endpoint: string; fireAt: Date; prayerKey: string; sent: boolean }> } {
  const subscriptions = new Map<string, boolean>();
  const schedules: Array<{ endpoint: string; fireAt: Date; prayerKey: string; sent: boolean }> = [];

  return {
    subscriptions,
    schedules,
    async upsertSubscriptionAndSchedule(sub, schedule: ScheduleEntry[]) {
      subscriptions.set(sub.endpoint, true);
      for (const entry of schedule) {
        schedules.push({ endpoint: sub.endpoint, fireAt: entry.fireAt, prayerKey: entry.prayerKey, sent: false });
      }
    },
    async removeSubscription(endpoint: string) {
      subscriptions.delete(endpoint);
      for (let i = schedules.length - 1; i >= 0; i--) {
        if (schedules[i].endpoint === endpoint) schedules.splice(i, 1);
      }
    },
    async claimDueSchedules(now: Date): Promise<DueNotification[]> {
      const due: DueNotification[] = [];
      schedules.forEach((row, i) => {
        if (!row.sent && row.fireAt.getTime() <= now.getTime() && subscriptions.has(row.endpoint)) {
          row.sent = true;
          due.push({
            scheduleId: String(i),
            endpoint: row.endpoint,
            p256dh: 'p256dh',
            auth: 'auth',
            fireAt: row.fireAt,
            prayerKey: row.prayerKey,
          });
        }
      });
      return due;
    },
    async cleanupOldSchedules(cutoff: Date) {
      let removed = 0;
      for (let i = schedules.length - 1; i >= 0; i--) {
        if (schedules[i].fireAt.getTime() < cutoff.getTime()) {
          schedules.splice(i, 1);
          removed++;
        }
      }
      return removed;
    },
    async checkHealth() {
      return true;
    },
    async listSubscriptions() {
      return [...subscriptions.keys()].map((endpoint) => ({ endpoint, p256dh: 'p256dh', auth: 'auth' }));
    },
  };
}

function minutesFromNow(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * 60000);
}

test('createPushCron sends a push for a due, on-time schedule entry', async () => {
  const store = createFakeStore();
  const now = new Date('2026-08-10T12:00:00.000Z');
  await store.upsertSubscriptionAndSchedule({ endpoint: 'e1', p256dh: 'a', auth: 'b' }, [
    { fireAt: minutesFromNow(now, -1), prayerKey: 'ogle' },
  ]);
  const sent: unknown[] = [];
  const cron = createPushCron({
    store,
    sendNotification: async (sub, payload) => {
      sent.push({ sub, payload });
    },
    now: () => now,
  });

  const result = await cron.tick();

  assert.equal(sent.length, 1);
  assert.equal(result.sent, 1);
  assert.equal(result.skippedStale, 0);
});

// The actual reported requirement: a server outage of over an hour must
// not cause a burst of hours-late "prayer time has started" pushes once it
// comes back up.
test('createPushCron does not send a schedule entry more than 10 minutes late', async () => {
  const store = createFakeStore();
  const now = new Date('2026-08-10T12:00:00.000Z');
  await store.upsertSubscriptionAndSchedule({ endpoint: 'e1', p256dh: 'a', auth: 'b' }, [
    { fireAt: minutesFromNow(now, -65), prayerKey: 'ogle' }, // an hour+ late
  ]);
  const sent: unknown[] = [];
  const cron = createPushCron({
    store,
    sendNotification: async (sub, payload) => {
      sent.push({ sub, payload });
    },
    now: () => now,
  });

  const result = await cron.tick();

  assert.equal(sent.length, 0, 'must not send a stale notification');
  assert.equal(result.skippedStale, 1);
  assert.equal(result.sent, 0);
});

test('createPushCron sends a schedule entry exactly at the 10-minute boundary but not just past it', async () => {
  const store = createFakeStore();
  const now = new Date('2026-08-10T12:00:00.000Z');
  await store.upsertSubscriptionAndSchedule({ endpoint: 'e1', p256dh: 'a', auth: 'b' }, [
    { fireAt: minutesFromNow(now, -10), prayerKey: 'imsak' },
    { fireAt: minutesFromNow(now, -10.5), prayerKey: 'yatsi' },
  ]);
  const sent: string[] = [];
  const cron = createPushCron({
    store,
    sendNotification: async (_sub, payload) => {
      sent.push(JSON.parse(payload).title);
    },
    now: () => now,
  });

  const result = await cron.tick();

  assert.equal(result.sent, 1);
  assert.equal(result.skippedStale, 1);
  assert.ok(sent[0].includes('İmsak'));
});

test('createPushCron removes the subscription when the push service reports 404', async () => {
  const store = createFakeStore();
  const now = new Date('2026-08-10T12:00:00.000Z');
  await store.upsertSubscriptionAndSchedule({ endpoint: 'dead-endpoint', p256dh: 'a', auth: 'b' }, [
    { fireAt: minutesFromNow(now, -1), prayerKey: 'ogle' },
  ]);
  const cron = createPushCron({
    store,
    sendNotification: async () => {
      const err = new Error('Gone') as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    },
    now: () => now,
  });

  const result = await cron.tick();

  assert.equal(result.expiredRemoved, 1);
  assert.equal(store.subscriptions.has('dead-endpoint'), false);
});

test('createPushCron removes the subscription when the push service reports 410', async () => {
  const store = createFakeStore();
  const now = new Date('2026-08-10T12:00:00.000Z');
  await store.upsertSubscriptionAndSchedule({ endpoint: 'dead-endpoint', p256dh: 'a', auth: 'b' }, [
    { fireAt: minutesFromNow(now, -1), prayerKey: 'ogle' },
  ]);
  const cron = createPushCron({
    store,
    sendNotification: async () => {
      const err = new Error('Gone') as Error & { statusCode: number };
      err.statusCode = 410;
      throw err;
    },
    now: () => now,
  });

  const result = await cron.tick();

  assert.equal(result.expiredRemoved, 1);
  assert.equal(store.subscriptions.has('dead-endpoint'), false);
});

test('createPushCron does not remove the subscription for a transient (non-404/410) send error', async () => {
  const store = createFakeStore();
  const now = new Date('2026-08-10T12:00:00.000Z');
  await store.upsertSubscriptionAndSchedule({ endpoint: 'flaky-endpoint', p256dh: 'a', auth: 'b' }, [
    { fireAt: minutesFromNow(now, -1), prayerKey: 'ogle' },
  ]);
  const cron = createPushCron({
    store,
    sendNotification: async () => {
      throw new Error('network blip');
    },
    now: () => now,
  });

  const result = await cron.tick();

  assert.equal(result.expiredRemoved, 0);
  assert.equal(store.subscriptions.has('flaky-endpoint'), true);
});

test('createPushCron cleans up schedule rows older than its retention window', async () => {
  const store = createFakeStore();
  const now = new Date('2026-08-10T12:00:00.000Z');
  await store.upsertSubscriptionAndSchedule({ endpoint: 'e1', p256dh: 'a', auth: 'b' }, [
    { fireAt: minutesFromNow(now, -60 * 24 * 2), prayerKey: 'old' },
  ]);
  const cron = createPushCron({ store, sendNotification: async () => {}, now: () => now, cleanupAgeMs: 60 * 60 * 1000 });

  const result = await cron.tick();

  assert.equal(result.cleanedUp, 1);
});
