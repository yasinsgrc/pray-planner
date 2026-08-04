import { HijriDateInfo, LocationItem, PrayerName } from '../types';
import { calculateDaySchedule } from './prayerCalculator';
import { getHijriDate } from './hijri';
import { resolveTimeZone } from './timezone';
import { formatTime } from './formatTime';

export interface MonthlyScheduleDay {
  date: Date;
  /** YYYY-MM-DD, calendar day (not device-local) — stable row key and today-match key. */
  dateKey: string;
  hijri: HijriDateInfo;
  prayers: { name: PrayerName; label: string; timeString: string }[];
}

export interface MonthlySchedule {
  year: number;
  month: number; // 1-12
  days: MonthlyScheduleDay[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function dateKeyFor(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function buildMonthlyScheduleUncached(location: LocationItem, methodName: string, year: number, month: number): MonthlySchedule {
  const timeZone = resolveTimeZone(location);
  const total = daysInMonth(year, month);
  const days: MonthlyScheduleDay[] = [];

  for (let day = 1; day <= total; day++) {
    const date = new Date(year, month - 1, day, 12, 0, 0);
    const raw = calculateDaySchedule(location, date, methodName);
    days.push({
      date,
      dateKey: dateKeyFor(year, month, day),
      hijri: getHijriDate(date, timeZone),
      prayers: raw.rawPrayers.map((p) => ({
        name: p.name,
        label: p.label,
        timeString: formatTime(p.dateObj, timeZone),
      })),
    });
  }

  return { year, month, days };
}

/**
 * Ekleme 4 (design-refresh-v3 Faz 19): bir aylık tablo, 30 gün x 3 PrayerTimes
 * kurulumu gerektiriyor. Ölçüm (31 günlük bir ay için gerçek performance.now()
 * ölçümü): ~2.5-5ms sıcak, ~10.7ms soğuk (JIT ısınması) — 16ms'lik kare
 * bütçesinin altında, bu yüzden chunking/requestIdleCallback yerine sade bir
 * modül seviyesi önbellek yeterli. Anahtar konum+yöntem+yıl+ay'a göre — aynı
 * ay ileri geri gezinildiğinde yeniden hesaplama yapılmaz.
 */
const cache = new Map<string, MonthlySchedule>();

function cacheKey(location: LocationItem, methodName: string, year: number, month: number): string {
  return `${location.id}|${methodName}|${year}|${month}`;
}

export function buildMonthlySchedule(location: LocationItem, methodName: string, year: number, month: number): MonthlySchedule {
  const key = cacheKey(location, methodName, year, month);
  const cached = cache.get(key);
  if (cached) return cached;

  const built = buildMonthlyScheduleUncached(location, methodName, year, month);
  cache.set(key, built);
  return built;
}

export function clearMonthlyScheduleCache(): void {
  cache.clear();
}
