/**
 * Coordinate-free push scheduling store (design-refresh-v3 Faz 15). The
 * server is deliberately dumb: it never sees a coordinate, a city, or a
 * calculation method — the client computes every prayer time itself
 * (single source of truth stays in src/utils/prayerCalculator.ts) and hands
 * the server nothing but a list of future UTC instants to fire at. This
 * file only knows how to store those instants and atomically claim the
 * ones that are due.
 */

export interface ScheduleEntry {
  fireAt: Date;
  /** e.g. "ogle" (main prayer) or "ogle-early:15" (early warning, embeds
   * minutesBefore so the notification title can be built without the
   * server knowing anything else about the user's preferences). */
  prayerKey: string;
}

export interface DueNotification {
  scheduleId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  fireAt: Date;
  prayerKey: string;
}

export interface PushStore {
  /** Upserts the subscription and REPLACES its entire schedule with the
   * given list — used by both /api/push/subscribe (first time) and
   * /api/push/schedule (refresh); the two only differ in intent, not in
   * what they do to storage. */
  upsertSubscriptionAndSchedule(
    subscription: { endpoint: string; p256dh: string; auth: string },
    schedule: ScheduleEntry[]
  ): Promise<void>;
  /** Deletes the subscription and every schedule row that belongs to it. */
  removeSubscription(endpoint: string): Promise<void>;
  /** Every current subscription's raw push credentials — for ops/manual
   * testing (server/send-test-push.ts), not used by the cron itself. */
  listSubscriptions(): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>>;
  /**
   * Atomically marks every unsent row with fire_at <= now as sent and
   * returns them — two concurrent calls (e.g. the cron firing twice
   * before the first run finished) never return overlapping rows, so a
   * caller that sends a push for each returned row can never double-send
   * for the same schedule entry.
   */
  claimDueSchedules(now: Date): Promise<DueNotification[]>;
  /** Deletes schedule rows with fire_at older than the cutoff, sent or not. */
  cleanupOldSchedules(cutoff: Date): Promise<number>;
  checkHealth(): Promise<boolean>;
}

export interface PgPoolLike {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS push_schedules (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
    fire_at TIMESTAMPTZ NOT NULL,
    prayer_key TEXT NOT NULL,
    sent_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS push_schedules_due_idx ON push_schedules (fire_at) WHERE sent_at IS NULL;
`;

export async function createPostgresPushStore(pool: PgPoolLike): Promise<PushStore> {
  await pool.query(CREATE_TABLES_SQL);

  async function upsertSubscriptionAndSchedule(
    subscription: { endpoint: string; p256dh: string; auth: string },
    schedule: ScheduleEntry[]
  ): Promise<void> {
    const { rows } = await pool.query(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth)
       VALUES ($1, $2, $3)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = $2, auth = $3
       RETURNING id`,
      [subscription.endpoint, subscription.p256dh, subscription.auth]
    );
    const subscriptionId = rows[0].id;

    // Replace, not merge — a stale schedule from a since-changed location
    // or calculation method must never linger (design-refresh-v3 Faz 15).
    await pool.query('DELETE FROM push_schedules WHERE subscription_id = $1', [subscriptionId]);

    for (const entry of schedule) {
      await pool.query(
        'INSERT INTO push_schedules (subscription_id, fire_at, prayer_key) VALUES ($1, $2, $3)',
        [subscriptionId, entry.fireAt.toISOString(), entry.prayerKey]
      );
    }
  }

  async function removeSubscription(endpoint: string): Promise<void> {
    // ON DELETE CASCADE on push_schedules.subscription_id handles the
    // schedule rows — no separate DELETE needed.
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
  }

  async function claimDueSchedules(now: Date): Promise<DueNotification[]> {
    // A single atomic UPDATE ... RETURNING is the claim: Postgres takes a
    // row lock per matched row, so two overlapping transactions can never
    // both see sent_at IS NULL for the same row — the second one to reach
    // it finds it already marked and simply doesn't return it. No
    // additional SELECT ... FOR UPDATE step is needed for this shape.
    const { rows } = await pool.query(
      `UPDATE push_schedules
       SET sent_at = now()
       WHERE sent_at IS NULL AND fire_at <= $1
       RETURNING id, subscription_id, fire_at, prayer_key`,
      [now.toISOString()]
    );
    if (rows.length === 0) return [];

    const subscriptionIds = [...new Set(rows.map((r) => r.subscription_id))];
    const { rows: subRows } = await pool.query(
      `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE id = ANY($1::int[])`,
      [subscriptionIds]
    );
    const subsById = new Map(subRows.map((s) => [s.id, s]));

    const due: DueNotification[] = [];
    for (const row of rows) {
      const sub = subsById.get(row.subscription_id);
      if (!sub) continue; // subscription deleted between the two queries
      due.push({
        scheduleId: String(row.id),
        endpoint: sub.endpoint as string,
        p256dh: sub.p256dh as string,
        auth: sub.auth as string,
        fireAt: new Date(row.fire_at as string),
        prayerKey: row.prayer_key as string,
      });
    }
    return due;
  }

  async function cleanupOldSchedules(cutoff: Date): Promise<number> {
    const { rows } = await pool.query(
      'DELETE FROM push_schedules WHERE fire_at < $1 RETURNING id',
      [cutoff.toISOString()]
    );
    return rows.length;
  }

  async function checkHealth(): Promise<boolean> {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async function listSubscriptions(): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>> {
    const { rows } = await pool.query('SELECT endpoint, p256dh, auth FROM push_subscriptions');
    return rows.map((r) => ({ endpoint: r.endpoint as string, p256dh: r.p256dh as string, auth: r.auth as string }));
  }

  return {
    upsertSubscriptionAndSchedule,
    removeSubscription,
    claimDueSchedules,
    cleanupOldSchedules,
    checkHealth,
    listSubscriptions,
  };
}

/**
 * Zero-setup local-dev default (no Postgres required) — mirrors the old
 * subscriptionStore.ts's file-vs-Postgres split, but in-memory instead of
 * file-backed since push scheduling doesn't need to survive a dev-server
 * restart the way subscriptions once did. NOT for production (Railway's
 * filesystem is ephemeral and ALSO single-instance-per-process only, so an
 * in-memory store would lose everything on every deploy).
 *
 * The claim step relies on Node's single-threaded execution: reading and
 * marking `sentAt` happens with no `await` in between, so two calls that
 * are logically "concurrent" (e.g. both awaited via Promise.all) can never
 * both observe the same row as unclaimed — the exact guarantee the real
 * Postgres UPDATE ... RETURNING provides via row locks.
 */
export function createInMemoryPushStore(): PushStore {
  interface Subscription {
    id: number;
    endpoint: string;
    p256dh: string;
    auth: string;
  }
  interface ScheduleRow {
    id: number;
    subscriptionId: number;
    fireAt: Date;
    prayerKey: string;
    sentAt: Date | null;
  }

  let nextSubId = 1;
  let nextScheduleId = 1;
  const subscriptions = new Map<string, Subscription>(); // keyed by endpoint
  const schedules: ScheduleRow[] = [];

  async function upsertSubscriptionAndSchedule(
    subscription: { endpoint: string; p256dh: string; auth: string },
    schedule: ScheduleEntry[]
  ): Promise<void> {
    let sub = subscriptions.get(subscription.endpoint);
    if (sub) {
      sub.p256dh = subscription.p256dh;
      sub.auth = subscription.auth;
    } else {
      sub = { id: nextSubId++, ...subscription };
      subscriptions.set(subscription.endpoint, sub);
    }

    for (let i = schedules.length - 1; i >= 0; i--) {
      if (schedules[i].subscriptionId === sub.id) schedules.splice(i, 1);
    }
    for (const entry of schedule) {
      schedules.push({
        id: nextScheduleId++,
        subscriptionId: sub.id,
        fireAt: entry.fireAt,
        prayerKey: entry.prayerKey,
        sentAt: null,
      });
    }
  }

  async function removeSubscription(endpoint: string): Promise<void> {
    const sub = subscriptions.get(endpoint);
    if (!sub) return;
    subscriptions.delete(endpoint);
    for (let i = schedules.length - 1; i >= 0; i--) {
      if (schedules[i].subscriptionId === sub.id) schedules.splice(i, 1);
    }
  }

  async function claimDueSchedules(now: Date): Promise<DueNotification[]> {
    const due: DueNotification[] = [];
    for (const row of schedules) {
      if (row.sentAt !== null || row.fireAt.getTime() > now.getTime()) continue;
      row.sentAt = now; // synchronous claim, no await between check and mark
      const sub = [...subscriptions.values()].find((s) => s.id === row.subscriptionId);
      if (!sub) continue;
      due.push({
        scheduleId: String(row.id),
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        fireAt: row.fireAt,
        prayerKey: row.prayerKey,
      });
    }
    return due;
  }

  async function cleanupOldSchedules(cutoff: Date): Promise<number> {
    let removed = 0;
    for (let i = schedules.length - 1; i >= 0; i--) {
      if (schedules[i].fireAt.getTime() < cutoff.getTime()) {
        schedules.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  async function checkHealth(): Promise<boolean> {
    return true;
  }

  async function listSubscriptions(): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>> {
    return [...subscriptions.values()].map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }));
  }

  return {
    upsertSubscriptionAndSchedule,
    removeSubscription,
    claimDueSchedules,
    cleanupOldSchedules,
    listSubscriptions,
    checkHealth,
  };
}
