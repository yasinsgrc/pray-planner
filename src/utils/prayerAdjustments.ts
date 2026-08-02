import { PrayerName, PrayerAdjustments } from '../types';
import { formatTime } from './formatTime';

/**
 * Applies the user's per-prayer minute correction (Ayarlar > Hesaplama >
 * Vakit Düzeltmesi, design-refresh-v3 Faz 7 F5) to a DISPLAYED clock time
 * only. Deliberately never touches which prayer is active/next, the
 * countdown, ring progress, kerahet windows, or push-notification timing —
 * all of those keep using the true adhan-computed instant, both so the
 * app's own state stays internally consistent and because the server
 * (which actually fires notifications) has no knowledge of this
 * client-only, localStorage-held preference. This is a personal display
 * correction for comparing against a published table, not a change to
 * when anything actually happens.
 */
export function formatAdjustedTime(
  dateObj: Date,
  prayer: PrayerName,
  adjustments: PrayerAdjustments,
  timeZone?: string
): string {
  const minutes = adjustments[prayer] ?? 0;
  if (minutes === 0) return formatTime(dateObj, timeZone);
  return formatTime(new Date(dateObj.getTime() + minutes * 60000), timeZone);
}
