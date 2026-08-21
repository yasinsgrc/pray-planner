export const LOW_ACCURACY_THRESHOLD_M = 1000;

/**
 * findNearestLocation() picks the closest bundled centroid by straight-line
 * distance — a real limitation, already documented in types.ts's
 * isGpsDerived comment (Faz 14: GPS in Darıca matched "Çayırova", an
 * adjacent district with a very close center). When GPS itself reports poor
 * accuracy (>1000m, coords.accuracy), a specific district guess is even
 * less trustworthy than usual — fall back to the province name instead of
 * asserting a district (design-refresh-v3 Faz 24 Commit 3). "(yaklaşık)" is
 * a fixed parenthetical, not a bound suffix, so no vowel-harmony inflection
 * is needed regardless of the preceding word.
 */
export function resolveGpsDistrictLabel(
  nearest: { cityName: string; districtName: string },
  accuracyMeters: number
): string {
  if (accuracyMeters > LOW_ACCURACY_THRESHOLD_M) {
    return `${nearest.cityName} (yaklaşık)`;
  }
  return nearest.districtName;
}
