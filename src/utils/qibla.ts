import { LocationItem } from '../types';

const KAABA_LAT = (21.4225 * Math.PI) / 180;
const KAABA_LNG = (39.8262 * Math.PI) / 180;

/** Great-circle bearing (0-360, clockwise from true north) from a location to the Kaaba. */
export function calculateQiblaBearing(location: LocationItem): number {
  const userLat = (location.lat * Math.PI) / 180;
  const userLng = (location.lng * Math.PI) / 180;

  const y = Math.sin(KAABA_LNG - userLng);
  const x =
    Math.cos(userLat) * Math.tan(KAABA_LAT) - Math.sin(userLat) * Math.cos(KAABA_LNG - userLng);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}
