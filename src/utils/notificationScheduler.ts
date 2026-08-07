import { PushScheduleEntry } from './pushSchedule';
import { buildLocalNotificationText } from './notificationText';

/** Android 8+ fixes a channel's sound at creation time — versioned so a future sound change can ship as `_v2` without inheriting the old channel's locked-in sound (design-refresh-v3 Faz 23 Commit 2). */
export const EZAN_CHANNEL_ID = 'vakit_ezan_v1';
/** Reserved for a genuinely silent-but-visible notification — buildPushSchedule currently drops every 'sessiz'-flagged entry before it ever reaches this module, so nothing maps here today, but the channel exists so that can change without a migration. */
export const SILENT_CHANNEL_ID = 'vakit_sessiz_v1';

export interface LocalNotificationRequest {
  /** 32-bit int, per Capacitor's LocalNotificationSchema — a plain sequential index since the whole batch is cancelled and replaced together (see cancelAllNativeNotifications), never merged with a previous one. */
  id: number;
  title: string;
  body: string;
  at: Date;
  channelId: string;
}

/**
 * Converts buildPushSchedule's (pushSchedule.ts) output into local
 * notification requests — no new prayer-time calculation happens here,
 * only text lookup and Capacitor's request shape (design-refresh-v3 Faz 23
 * Commit 2). Pure: takes `now` explicitly rather than reading the clock,
 * so a schedule built slightly in the past (the caller may have paused
 * before scheduling) still gets a defensive re-filter here.
 */
export function buildLocalNotificationRequests(
  entries: PushScheduleEntry[],
  now: Date
): LocalNotificationRequest[] {
  const requests: LocalNotificationRequest[] = [];

  for (const entry of entries) {
    const at = new Date(entry.fireAt);
    if (at.getTime() <= now.getTime()) continue;

    const text = buildLocalNotificationText(entry.prayerKey);
    if (!text) continue;

    requests.push({
      id: requests.length,
      title: text.title,
      body: text.body,
      at,
      // Every entry reaching this point already passed buildPushSchedule's
      // own 'sessiz' filter (only 'bildirim'-flagged prayers/early-warnings
      // survive into PushScheduleEntry[]), so this is always the audible
      // channel today — see SILENT_CHANNEL_ID's own comment.
      channelId: EZAN_CHANNEL_ID,
    });
  }

  return requests;
}
