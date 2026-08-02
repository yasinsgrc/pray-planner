// Formatters are memoized per timezone — constructing an Intl.DateTimeFormat
// is not free, and this runs on every ticking-clock render.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone?: string): Intl.DateTimeFormat {
  const key = timeZone ?? '__device__';
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      ...(timeZone ? { timeZone } : {}),
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Single shared HH:mm formatter — every prayer/kerahet time in the app
 * goes through this. `timeZone` should be the selected location's own IANA
 * zone (DayPrayerSchedule.resolvedTimeZone) — without it, this silently
 * falls back to the device's zone, which is wrong whenever the selected
 * location isn't in the same zone the phone is physically in (design-
 * refresh-v3 Faz 4 F3: adhan computes correct absolute instants regardless,
 * but display formatting was always using the device's zone to write them
 * out).
 */
export function formatTime(date: Date, timeZone?: string): string {
  return getFormatter(timeZone).format(date);
}
