import { LocationItem, PrayerName } from '../types';
import { calculateDaySchedule } from './prayerCalculator';
import { resolveTimeZone } from './timezone';

export interface WidgetPayload {
  /** Veri sözleşmesi sürümü. Native taraf bunu doğrular, uyuşmazsa çizmez. */
  schemaVersion: 1;
  /** Kullanıcıya gösterilecek konum adı, örn. "Çayırova". */
  locationLabel: string;
  /** IANA zaman dilimi, örn. "Europe/Istanbul". */
  timeZone: string;
  /** Bu yükün üretildiği an (epoch ms) — bayatlık tespiti için. */
  generatedAtMs: number;
  /** Kronolojik sıralı, bugünden itibaren `days` günün tüm vakitleri. */
  entries: { name: PrayerName; label: string; atMs: number }[];
}

const DEFAULT_DAYS = 7;

/**
 * adhan Kotlin'e port edilmez (design-refresh-v3 Faz 23 Commit 3) — JS
 * tarafı vakitleri epoch ms olarak yazar, native taraf yalnızca aritmetik
 * yapar. calculateDaySchedule zaten mevcut hesaplamayı yapıyor; bu
 * fonksiyon onu `days` kere çağırıp sonuçları düzleştirmekten başka bir
 * şey yapmaz — yeni bir hesaplama yolu yok.
 *
 * 7 gün varsayılan: kullanıcı uygulamayı günlerce açmayabilir, tek günlük
 * veri widget'ı ertesi gün donuk bırakır.
 */
export function buildWidgetPayload(
  location: LocationItem,
  methodName: string,
  now: Date,
  days: number = DEFAULT_DAYS
): WidgetPayload {
  const entries: WidgetPayload['entries'] = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    const day = calculateDaySchedule(location, date, methodName);
    for (const prayer of day.rawPrayers) {
      entries.push({ name: prayer.name, label: prayer.label, atMs: prayer.dateObj.getTime() });
    }
  }

  return {
    schemaVersion: 1,
    locationLabel: location.districtName,
    timeZone: resolveTimeZone(location),
    generatedAtMs: now.getTime(),
    entries,
  };
}
