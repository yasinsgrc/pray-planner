import { PrayerName } from '../types';
import { PRAYER_LABELS } from '../data/strings';

export interface LocalNotificationText {
  title: string;
  body: string;
}

const PRAYER_NAMES = new Set<string>(Object.keys(PRAYER_LABELS));

/**
 * Client-side mirror of server/pushPayload.ts's buildNotificationPayload —
 * native local notifications never touch the server (design-refresh-v3
 * Faz 23 Commit 2: no server round-trip exists for a local notification by
 * definition), so the same prayer_key -> text mapping has to exist here
 * too. Every string below is copied verbatim from server/pushPayload.ts,
 * not reworded — keep both in sync by hand if either ever changes.
 */
export function buildLocalNotificationText(prayerKey: string): LocalNotificationText | null {
  const earlyMatch = prayerKey.match(/^(\w+)-early:(\d+)$/);
  if (earlyMatch) {
    const [, name, minutes] = earlyMatch;
    if (!PRAYER_NAMES.has(name)) return null;
    if (name === 'gunes') {
      return {
        title: `Sabah Namazı Vaktinin Bitmesine ${minutes} Dakika Kaldı`,
        body: 'Bu sürenin sonunda kerahet vakti başlar.',
      };
    }
    const label = PRAYER_LABELS[name as PrayerName];
    return {
      title: `${label} Vaktine ${minutes} Dakika Kaldı`,
      body: 'Abdest ve hazırlık için hatırlatma.',
    };
  }

  if (prayerKey === 'gunes') {
    return { title: 'Sabah Namazı Vakti Sona Erdi', body: 'Güneş doğdu, kerahet vakti başladı.' };
  }

  // Mirrors server/pushPayload.ts's "ogle-cuma" handling verbatim.
  if (prayerKey === 'ogle-cuma') {
    return { title: 'Cuma Vakti', body: 'Hayırlı Cumalar' };
  }

  if (PRAYER_NAMES.has(prayerKey)) {
    const label = PRAYER_LABELS[prayerKey as PrayerName];
    return { title: `${label} Vakti Girdi`, body: 'Hayırlı namazlar.' };
  }

  return null;
}
