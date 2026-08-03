import { Coordinates, Qibla } from 'adhan';
import { LocationItem } from '../types';

/**
 * Great-circle bearing (0-360, clockwise from true north) from a location
 * to the Kaaba — delegates to adhan's own Qibla function (same
 * spherical-trigonometry formula this app already trusts for prayer
 * times) instead of a hand-rolled reimplementation, per design-refresh-v3
 * Faz 13.
 */
export function calculateQiblaBearing(location: LocationItem): number {
  return Qibla(new Coordinates(location.lat, location.lng));
}
