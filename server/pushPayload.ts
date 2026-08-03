import { PRAYER_LABELS, PrayerName } from './prayerLabels';

const PRAYER_NAMES = new Set<string>(Object.keys(PRAYER_LABELS));

export interface NotificationPayload {
  title: string;
  body: string;
}

/**
 * Turns a schedule row's prayer_key back into notification text — this is
 * the ONLY place the server knows what a prayer_key "means", and it's
 * pure string formatting, never a coordinate or a calculation
 * (design-refresh-v3 Faz 15). Format: "ogle" (main prayer) or
 * "ogle-early:15" (early warning, N minutes before). Returns null for a
 * key it doesn't recognize rather than sending a garbled notification.
 */
export function buildNotificationPayload(prayerKey: string): NotificationPayload | null {
  const earlyMatch = prayerKey.match(/^(\w+)-early:(\d+)$/);
  if (earlyMatch) {
    const [, name, minutes] = earlyMatch;
    if (!PRAYER_NAMES.has(name)) return null;
    const label = PRAYER_LABELS[name as PrayerName];
    return {
      title: `${label} Vaktine ${minutes} Dakika Kaldı`,
      body: 'Abdest ve hazırlık için hatırlatma.',
    };
  }

  if (PRAYER_NAMES.has(prayerKey)) {
    const label = PRAYER_LABELS[prayerKey as PrayerName];
    return { title: `${label} Vakti Girdi`, body: 'Hayırlı namazlar.' };
  }

  return null;
}
