import { LocationItem } from '../types';
import { ALL_LOCATIONS } from '../data/locations';

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in kilometers. */
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Nearest known city to a raw coordinate pair, by straight-line distance.
 * Used both when reverse-geocoding fails (server unreachable or the app is
 * deployed statically, with no Express backend at all) and for the silent
 * "you seem to have moved" check — GPS gives precise coordinates but no
 * human-readable name. Searches the full ~430-entry ALL_LOCATIONS (every
 * province + populous district, design-refresh-v3 Faz 6 B1) rather than the
 * small POPULAR_LOCATIONS quick-pick list, since a real nearest-city match
 * needs the full dataset to be meaningfully accurate.
 */
export function findNearestLocation(lat: number, lng: number): LocationItem {
  let nearest = ALL_LOCATIONS[0];
  let minDistance = Infinity;
  for (const loc of ALL_LOCATIONS) {
    const distance = haversineDistanceKm(lat, lng, loc.lat, loc.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = loc;
    }
  }
  return nearest;
}
