const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)/;

/**
 * Google Play requires each upload's versionCode to be strictly greater
 * than the previous one — this derives it from package.json's semver so
 * android/app/build.gradle never carries a hand-maintained, easy-to-forget
 * second version number (design-refresh-v3 Faz 23 Commit 1). Assumes
 * minor/patch stay under 100 (standard for this project's release cadence);
 * exceeding that would need a wider multiplier, not a workaround here.
 */
export function computeAndroidVersionCode(semver: string): number {
  const match = SEMVER_PATTERN.exec(semver);
  if (!match) {
    throw new Error(`computeAndroidVersionCode: "${semver}" is not a valid semver string`);
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  return major * 10000 + minor * 100 + patch;
}
