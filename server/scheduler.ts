import type { LocationItem, NotificationSettings, PrayerName, SoundMode } from '../src/types';
import type { DayPrayerSchedule } from '../src/utils/prayerCalculator';
import type { SubscriptionStore } from './subscriptionStore';
import type { PushSubscriptionRecord } from './types';

export type NotificationEvent =
  | { type: 'prayer'; prayerName: PrayerName; label: string; soundMode: SoundMode }
  | {
      type: 'early-warning';
      prayerName: PrayerName;
      label: string;
      soundMode: SoundMode;
      minutesBefore: number;
    };

export interface PrayerLike {
  name: PrayerName;
  label: string;
  dateObj: Date;
}

export function shouldNotifyNow(
  prayer: PrayerLike,
  now: Date,
  notifications: NotificationSettings,
  toleranceMs = 30000
): NotificationEvent | null {
  const soundMode = notifications[prayer.name];
  const diffToExactTime = Math.abs(now.getTime() - prayer.dateObj.getTime());

  if (diffToExactTime <= toleranceMs && soundMode !== 'sessiz') {
    return { type: 'prayer', prayerName: prayer.name, label: prayer.label, soundMode };
  }

  const { earlyWarningMinutes, earlyWarningSound } = notifications;
  if (earlyWarningMinutes > 0 && earlyWarningSound !== 'sessiz') {
    const warningTime = prayer.dateObj.getTime() - earlyWarningMinutes * 60000;
    const diffToWarningTime = Math.abs(now.getTime() - warningTime);

    if (diffToWarningTime <= toleranceMs) {
      return {
        type: 'early-warning',
        prayerName: prayer.name,
        label: prayer.label,
        soundMode: earlyWarningSound,
        minutesBefore: earlyWarningMinutes,
      };
    }
  }

  return null;
}

type CalculatePrayerTimesFn = (
  location: LocationItem,
  date: Date,
  calculationMethod: string
) => DayPrayerSchedule;

export interface SchedulerDeps {
  store: SubscriptionStore;
  calculatePrayerTimes: CalculatePrayerTimesFn;
  sendPush: (record: PushSubscriptionRecord, event: NotificationEvent) => Promise<void>;
  now?: () => Date;
}

export interface Scheduler {
  tick: () => Promise<void>;
  start: (intervalMs?: number) => () => void;
}

export function createScheduler(deps: SchedulerDeps): Scheduler {
  const sentToday = new Set<string>();
  let lastDayKey = '';

  function dayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  // Recomputes prayer times for every subscription on every tick, even
  // when many subscriptions share the same city — fine at today's scale,
  // but once subscriber count reaches four digits this becomes the
  // dominant cost every minute. If that happens, group subscriptions by
  // (location, calculationMethod) and call calculatePrayerTimes once per
  // group instead of once per subscription (design-refresh-v3 Faz 6 B5).
  async function tick(): Promise<void> {
    const now = (deps.now ?? (() => new Date()))();
    const today = dayKey(now);

    if (today !== lastDayKey) {
      sentToday.clear();
      lastDayKey = today;
    }

    const subscriptions = await deps.store.loadSubscriptions();

    for (const sub of subscriptions) {
      try {
        const schedule = deps.calculatePrayerTimes(sub.location, now, sub.calculationMethod);

        for (const prayer of schedule.prayers) {
          const event = shouldNotifyNow(prayer, now, sub.notifications);
          if (!event) continue;

          const key = `${sub.endpoint}:${event.type}:${event.prayerName}:${today}`;
          if (sentToday.has(key)) continue;

          sentToday.add(key);
          await deps.sendPush(sub, event);
        }
      } catch (err) {
        console.error(`Zamanlayıcı: abonelik işlenemedi (${sub.endpoint}):`, err);
        continue;
      }
    }
  }

  function start(intervalMs = 60000): () => void {
    const id = setInterval(() => {
      tick().catch((err) => console.error('Zamanlayıcı hatası:', err));
    }, intervalMs);
    return () => clearInterval(id);
  }

  return { tick, start };
}
