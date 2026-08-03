import type { PushStore, DueNotification } from './pushStore';
import { buildNotificationPayload } from './pushPayload';

export interface PushSendSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushCronDeps {
  store: PushStore;
  sendNotification: (subscription: PushSendSubscription, payload: string) => Promise<unknown>;
  now?: () => Date;
  /** A schedule entry this much older than its fire_at is skipped instead
   * of sent — a server outage must not produce a burst of hours-late
   * "prayer time has started" pushes once it recovers. */
  maxAgeMs?: number;
  /** Schedule rows (sent or not) older than this are purged every tick. */
  cleanupAgeMs?: number;
}

export interface PushCronResult {
  claimed: number;
  sent: number;
  skippedStale: number;
  expiredRemoved: number;
  cleanedUp: number;
}

export interface PushCron {
  tick: () => Promise<PushCronResult>;
  start: (intervalMs?: number) => () => void;
}

const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;
const DEFAULT_CLEANUP_AGE_MS = 24 * 60 * 60 * 1000;

export function createPushCron(deps: PushCronDeps): PushCron {
  const maxAgeMs = deps.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const cleanupAgeMs = deps.cleanupAgeMs ?? DEFAULT_CLEANUP_AGE_MS;

  async function sendOne(row: DueNotification): Promise<'sent' | 'expired' | 'error'> {
    const payload = buildNotificationPayload(row.prayerKey);
    if (!payload) {
      console.error(`Zamanlayıcı: tanınmayan prayer_key "${row.prayerKey}" (${row.scheduleId}), atlanıyor.`);
      return 'error';
    }
    try {
      await deps.sendNotification(
        { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
        JSON.stringify(payload)
      );
      return 'sent';
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        return 'expired';
      }
      console.error(`Zamanlayıcı: push gönderim hatası (${row.endpoint}):`, err);
      return 'error';
    }
  }

  async function tick(): Promise<PushCronResult> {
    const now = (deps.now ?? (() => new Date()))();

    // Atomically claims (marks sent_at) EVERY due row, on-time or stale —
    // claiming is "this row will never be considered again", which must
    // happen exactly once regardless of whether we go on to actually send
    // it. Deciding on-time-vs-stale is a business rule applied to already-
    // claimed rows, not part of the atomic step itself.
    const due = await deps.store.claimDueSchedules(now);

    let sent = 0;
    let skippedStale = 0;
    let expiredRemoved = 0;
    const expiredEndpoints = new Set<string>();

    for (const row of due) {
      const ageMs = now.getTime() - row.fireAt.getTime();
      if (ageMs > maxAgeMs) {
        skippedStale++;
        continue;
      }

      const outcome = await sendOne(row);
      if (outcome === 'sent') {
        sent++;
      } else if (outcome === 'expired') {
        expiredEndpoints.add(row.endpoint);
      }
      // 'error' (transient): already claimed, accept the miss rather than
      // retry — a missed prayer notification is far less harmful than a
      // duplicate or very-late one.
    }

    for (const endpoint of expiredEndpoints) {
      await deps.store.removeSubscription(endpoint);
      expiredRemoved++;
    }

    const cleanedUp = await deps.store.cleanupOldSchedules(new Date(now.getTime() - cleanupAgeMs));

    return { claimed: due.length, sent, skippedStale, expiredRemoved, cleanedUp };
  }

  function start(intervalMs = 60000): () => void {
    const id = setInterval(() => {
      tick().catch((err) => console.error('Zamanlayıcı hatası:', err));
    }, intervalMs);
    return () => clearInterval(id);
  }

  return { tick, start };
}
