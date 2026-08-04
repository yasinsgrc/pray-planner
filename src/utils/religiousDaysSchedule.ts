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
