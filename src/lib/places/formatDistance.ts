/** Rounds to whole meters below 1 km so a value like 999.6 m (which would
 * round to "1000 m") correctly falls into the km branch as "1,0 km" instead. */
export function formatDistance(distanceMeters: number): string {
  const roundedMeters = Math.round(distanceMeters);
  if (roundedMeters < 1000) return `${roundedMeters} m`;

  const km = distanceMeters / 1000;
  return `${km.toFixed(1).replace(".", ",")} km`;
}
