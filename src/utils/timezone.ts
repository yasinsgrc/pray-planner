/**
 * Small coordinate -> IANA time zone lookup for locations that didn't come
 * with one (search/reverse-geocode results from server/geocoding.ts, which
 * has no timezone field and is off-limits to edit — see LocationItem in
 * types.ts). Real timezone-from-coordinates lookup needs either an external
 * API call or a multi-megabyte polygon dataset; neither fits "don't add a
 * data layer for this" (design-refresh-v3 Faz 4). This is a deliberately
 * rough bounding-box approximation covering the regions this app's
 * audience is realistically searching for, falling back to the device's
 * own zone — right for same-zone browsing, an approximation everywhere
 * else, always better than silently assuming the device zone for a place
 * on the other side of the world.
 */
interface TimeZoneRegion {
  tz: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const REGIONS: TimeZoneRegion[] = [
  { tz: 'Europe/Istanbul', minLat: 35.8, maxLat: 42.2, minLng: 25.6, maxLng: 44.8 },
  { tz: 'Asia/Riyadh', minLat: 16, maxLat: 32.2, minLng: 34.5, maxLng: 55.7 },
  { tz: 'Asia/Dubai', minLat: 22.6, maxLat: 26.5, minLng: 51, maxLng: 56.4 },
  { tz: 'Africa/Cairo', minLat: 22, maxLat: 31.7, minLng: 25, maxLng: 35 },
  { tz: 'Africa/Casablanca', minLat: 27.6, maxLat: 35.9, minLng: -13.2, maxLng: -1 },
  { tz: 'Asia/Karachi', minLat: 23.6, maxLat: 37.1, minLng: 60.9, maxLng: 77.8 },
  { tz: 'Asia/Jakarta', minLat: -11, maxLat: 6, minLng: 95, maxLng: 114 },
  { tz: 'Asia/Kuala_Lumpur', minLat: 0.8, maxLat: 7.4, minLng: 99.6, maxLng: 119.3 },
  { tz: 'Europe/Sarajevo', minLat: 42.5, maxLat: 45.3, minLng: 15.7, maxLng: 19.6 },
  { tz: 'Europe/London', minLat: 49.9, maxLat: 60.9, minLng: -8.6, maxLng: 1.8 },
  { tz: 'Europe/Paris', minLat: 41.3, maxLat: 51.1, minLng: -5.2, maxLng: 9.6 },
  { tz: 'Europe/Berlin', minLat: 47.3, maxLat: 55.1, minLng: 5.9, maxLng: 15.0 },
  { tz: 'Europe/Amsterdam', minLat: 50.7, maxLat: 53.6, minLng: 3.3, maxLng: 7.3 },
  { tz: 'America/New_York', minLat: 24.5, maxLat: 47.5, minLng: -87, maxLng: -66.9 },
];

/** Best-effort IANA zone for a coordinate pair with no timeZone already attached. */
export function guessTimeZone(lat: number, lng: number): string {
  for (const region of REGIONS) {
    if (lat >= region.minLat && lat <= region.maxLat && lng >= region.minLng && lng <= region.maxLng) {
      return region.tz;
    }
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/** A LocationItem's time zone, resolved via guessTimeZone if it wasn't already set. */
export function resolveTimeZone(location: { lat: number; lng: number; timeZone?: string }): string {
  return location.timeZone ?? guessTimeZone(location.lat, location.lng);
}

/**
 * The Gregorian calendar day at `date`, as read in `timeZone` — `Date`'s own
 * getFullYear/getMonth/getDate always read the *device's* local zone, which
 * is wrong whenever the selected location is in a different zone (e.g. a
 * device in İstanbul past local midnight while the selected location is
 * still on the previous calendar day). Used both for the Hijri date
 * (hijri.ts) and for the calendar day handed to adhan's PrayerTimes
 * (prayerCalculator.ts, design-refresh-v3 Faz 5 F3) — adhan reads a Date's
 * Y/M/D the same device-local way, so it needs the same correction.
 */
export function getCalendarDateInZone(date: Date, timeZone?: string): { year: number; month: number; day: number } {
  if (!timeZone) {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}
