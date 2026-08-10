import { haversineDistanceKm } from './geo';

export interface LocationDriftPoint {
  lat: number;
  lng: number;
  ts: number;
}

export interface LocationDriftInput {
  current: { lat: number; lng: number; label: string; source: 'gps' | 'manual' };
  detected: { lat: number; lng: number; label: string; accuracy: number };
  dismissed: LocationDriftPoint | null;
  now: number;
}

const MAX_ACCEPTABLE_ACCURACY_M = 1000;
const MANUAL_THRESHOLD_KM = 50;
const GPS_THRESHOLD_KM = 5;
const DISMISSED_SUPPRESS_RADIUS_KM = 5;
const DISMISSED_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * "Başka bir şehirdesiniz gibi görünüyor" önerisinin tek karar noktası
 * (design-refresh-v3 Faz 24 Commit 2). Önceki mantık dağınıktı (App.tsx
 * içinde tek bir sabit 25km eşiği, doğruluk hiç kontrol edilmiyordu,
 * reddedilen bir öneri hiçbir yerde hatırlanmıyordu) — kullanıcı raporu
 * ("bazen çıkıyor bazen çıkmıyor") kısmen bunun yüzündendi: soğuk açılışta
 * hiç tetiklenmiyordu (yalnızca visibilitychange dinleniyordu), ve
 * reddedilen bir öneri aynı konumda tekrar tekrar çıkabiliyordu.
 */
export function shouldSuggestLocationChange(input: LocationDriftInput): boolean {
  const { current, detected, dismissed, now } = input;

  if (detected.accuracy > MAX_ACCEPTABLE_ACCURACY_M) return false;

  if (dismissed) {
    const distanceFromDismissed = haversineDistanceKm(dismissed.lat, dismissed.lng, detected.lat, detected.lng);
    if (distanceFromDismissed < DISMISSED_SUPPRESS_RADIUS_KM && now - dismissed.ts < DISMISSED_COOLDOWN_MS) {
      return false;
    }
  }

  const distanceFromCurrent = haversineDistanceKm(current.lat, current.lng, detected.lat, detected.lng);
  if (current.source === 'manual') {
    return distanceFromCurrent > MANUAL_THRESHOLD_KM;
  }
  return distanceFromCurrent > GPS_THRESHOLD_KM || detected.label !== current.label;
}

/** GPS'e hiç dokunmadan önce kontrol edilir — "izin verilmedi" durumunda
 * navigator.geolocation.getCurrentPosition çağrısı bile yapılmaz. */
export function isLocationDriftCheckAllowed(
  permissionState: 'granted' | 'denied' | 'prompt' | 'unsupported'
): boolean {
  return permissionState === 'granted';
}
