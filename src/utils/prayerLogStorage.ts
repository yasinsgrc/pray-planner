import { PrayerName } from '../types';

const STORAGE_KEY = 'vakit_prayer_log_v1';
const RETENTION_DAYS = 30;

export type PrayerLog = Record<string, PrayerName[]>; // "YYYY-MM-DD" -> marked prayers

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function loadPrayerLog(): PrayerLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Drops entries older than 30 days — keys are "YYYY-MM-DD" so lexicographic comparison is chronological. */
export function pruneOldEntries(log: PrayerLog, today: Date = new Date()): PrayerLog {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffKey = dateKey(cutoff);
  const pruned: PrayerLog = {};
  for (const [key, value] of Object.entries(log)) {
    if (key >= cutoffKey) pruned[key] = value;
  }
  return pruned;
}

export function savePrayerLog(log: PrayerLog): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // localStorage kullanılamıyor: sessizce yok say
  }
}

function getWeekStart(d: Date): Date {
  const day = d.getDay(); // 0=Pazar..6=Cumartesi
  const diff = (day === 0 ? -6 : 1) - day; // Pazartesi'ye kadar gün farkı
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Sum of marked prayers from this week's Monday through today (never counts future days). */
export function computeWeekCount(log: PrayerLog, today: Date = new Date()): number {
  const weekStart = getWeekStart(today);
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    if (d > today) break;
    count += log[dateKey(d)]?.length ?? 0;
  }
  return count;
}
