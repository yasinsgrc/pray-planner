import { LocationItem, NotificationSettings } from '../types';
import { calculateDaySchedule } from './prayerCalculator';

export interface PushScheduleEntry {
  /** ISO 8601 UTC instant — the server stores and fires this verbatim,
   * never recomputing it (design-refresh-v3 Faz 15: the server is a
   * coordinate-free timer, prayerCalculator.ts is the single source of
   * truth for when a prayer time actually is). */
  fireAt: string;
  /** e.g. "ogle" or "ogle-early:15" — see server/pushPayload.ts, the only
   * place that turns this back into notification text. */
  prayerKey: string;
}

const DAYS_AHEAD = 30;

/**
 * Every future push notification instant the user's current settings
 * imply, over the next 30 days — sent to POST /api/push/subscribe or
 * /api/push/schedule verbatim. Entries already in the past (e.g. today's
 * İmsak, if it's currently afternoon) are excluded: there's nothing to
 * gain from asking the server to store a schedule row it will only ever
 * mark stale-and-skip.
 */
export function buildPushSchedule(
  location: LocationItem,
  calculationMethod: string,
  notifications: NotificationSettings,
  now: Date = new Date()
): PushScheduleEntry[] {
  const entries: PushScheduleEntry[] = [];

  for (let dayOffset = 0; dayOffset < DAYS_AHEAD; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    const day = calculateDaySchedule(location, date, calculationMethod);

    for (const prayer of day.rawPrayers) {
      if (notifications[prayer.name] !== 'sessiz' && prayer.dateObj.getTime() > now.getTime()) {
        entries.push({ fireAt: prayer.dateObj.toISOString(), prayerKey: prayer.name });
      }

      if (notifications.earlyWarningMinutes > 0 && notifications.earlyWarningSound !== 'sessiz') {
        const warningAt = new Date(prayer.dateObj.getTime() - notifications.earlyWarningMinutes * 60000);
        if (warningAt.getTime() > now.getTime()) {
          entries.push({
            fireAt: warningAt.toISOString(),
            prayerKey: `${prayer.name}-early:${notifications.earlyWarningMinutes}`,
          });
        }
      }
    }
  }

  return entries;
}
