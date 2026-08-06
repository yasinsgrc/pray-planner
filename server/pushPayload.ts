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
    // Güneş is not a namaz vakti to prepare for — it's the moment Sabah
    // namazı's window closes. "Abdest ve hazırlık" wrongly implies you're
    // getting ready to pray at that moment (design-refresh-v3 Faz 20 madde 1).
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

  // Same reasoning as above: Güneş doğuşu bir namaz vaktinin başlangıcı
  // değil, Sabah namazı vaktinin sona erip İşrâk kerahetinin başladığı
  // andır — "Vakti Girdi" / "Hayırlı namazlar" burada namaza çağırır gibi
  // okunur, ki bu dinen yanlıştır.
  if (prayerKey === 'gunes') {
    return { title: 'Sabah Namazı Vakti Sona Erdi', body: 'Güneş doğdu, kerahet vakti başladı.' };
  }

  if (PRAYER_NAMES.has(prayerKey)) {
    const label = PRAYER_LABELS[prayerKey as PrayerName];
    return { title: `${label} Vakti Girdi`, body: 'Hayırlı namazlar.' };
  }

  return null;
}
