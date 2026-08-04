import { ReligiousDayEntry, RELIGIOUS_DAYS } from '../data/religiousDays';
import { getCalendarDateInZone } from './timezone';

function toUtcMidnight(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function todayKey(now: Date, timeZone?: string): string {
  const { year, month, day } = getCalendarDateInZone(now, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((toUtcMidnight(toKey) - toUtcMidnight(fromKey)) / MS_PER_DAY);
}

/**
 * Every entry from `todayKey` onward (inclusive), chronologically, each
 * annotated with its whole-day distance from today. Empty when the data
 * set (RELIGIOUS_DAYS) has no entry left at or after today — the UI must
 * show a "takvim güncellenecek" state in that case, not blank silence.
 */
export function getUpcomingReligiousDays(
  now: Date,
  timeZone?: string,
  entries: ReligiousDayEntry[] = RELIGIOUS_DAYS
): (ReligiousDayEntry & { daysRemaining: number })[] {
  const today = todayKey(now, timeZone);
  return entries
    .filter((e) => e.date >= today)
    .map((e) => ({ ...e, daysRemaining: daysBetween(today, e.date) }));
}

/**
 * Ramazan aralığı, "Ramazan Başlangıcı" ile ondan sonraki "Ramazan Bayramı
 * Arefesi" (Ramazan'ın son günü) arasında, RELIGIOUS_DAYS'teki DOĞRULANMIŞ
 * girdilerden kurulur — hicri aritmetikle hesaplanmaz (design-refresh-v3
 * Faz 19 Ekleme 6, madde 5'in aynı "hesaplama yok" kısıtına tabi).
 */
function ramadanRanges(entries: ReligiousDayEntry[]): { start: string; end: string }[] {
  const starts = entries.filter((e) => e.name === 'Ramazan Başlangıcı');
  const ranges: { start: string; end: string }[] = [];
  for (const s of starts) {
    const end = entries.find((e) => e.name === 'Ramazan Bayramı Arefesi' && e.date > s.date);
    if (end) ranges.push({ start: s.date, end: end.date });
  }
  return ranges;
}

/** Bugün Ramazan içindeyse gün numarası + Ramazan'ın toplam gün sayısını döner, değilse null. */
export function getRamadanInfo(
  now: Date,
  timeZone?: string,
  entries: ReligiousDayEntry[] = RELIGIOUS_DAYS
): { dayNumber: number; totalDays: number } | null {
  const today = todayKey(now, timeZone);
  const range = ramadanRanges(entries).find((r) => today >= r.start && today <= r.end);
  if (!range) return null;
  const totalDays = daysBetween(range.start, range.end) + 1;
  const dayNumber = daysBetween(range.start, today) + 1;
  return { dayNumber, totalDays };
}

export function getNextReligiousDay(
  now: Date,
  timeZone?: string,
  entries: ReligiousDayEntry[] = RELIGIOUS_DAYS
): { entry: ReligiousDayEntry; daysRemaining: number } | null {
  const upcoming = getUpcomingReligiousDays(now, timeZone, entries);
  if (upcoming.length === 0) return null;
  const { daysRemaining, ...entry } = upcoming[0];
  return { entry, daysRemaining };
}
