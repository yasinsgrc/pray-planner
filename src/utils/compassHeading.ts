export interface OrientationEventLike {
  webkitCompassHeading?: number;
  alpha: number | null;
  /** True only for a genuinely north-referenced reading — either a real
   * `deviceorientationabsolute` event, or a plain `deviceorientation` event
   * whose own `absolute` flag is true. */
  absolute: boolean;
}

/**
 * Device heading in true-north terms, or null when no north-referenced
 * source is available. A plain `deviceorientation` event with
 * `absolute: false` and no `webkitCompassHeading` carries NO true-north
 * information — its alpha is relative to wherever the device happened to
 * be pointed when the listener started. Treating that as a compass
 * heading anyway produces a compass that's silently wrong by an arbitrary,
 * session-specific offset (design-refresh-v3 Faz 13 — real-device report:
 * "Kıble pusulası yanlış çalışıyor"). Returning null here instead lets the
 * caller show an honest "we can't determine direction" state.
 */
export function computeHeadingFromOrientationEvent(event: OrientationEventLike): number | null {
  if (Number.isFinite(event.webkitCompassHeading)) {
    return event.webkitCompassHeading as number;
  }
  if (!event.absolute || event.alpha === null) {
    return null;
  }
  return (360 - event.alpha + 360) % 360;
}

/**
 * Compensates for the screen being rotated relative to the device's
 * natural (portrait) orientation — without this, holding the phone in
 * landscape reads ~90° off (design-refresh-v3 Faz 13).
 */
export function applyScreenOrientationCompensation(headingDeg: number, screenAngleDeg: number): number {
  return (headingDeg + screenAngleDeg + 360) % 360;
}

export function getAngularDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function isAlignedWithBearing(
  bearing: number,
  heading: number,
  toleranceDeg = 5
): boolean {
  return getAngularDifference(bearing, heading) <= toleranceDeg;
}

export interface CircularSmootherState {
  sin: number;
  cos: number;
  initialized: boolean;
}

export const INITIAL_SMOOTHER_STATE: CircularSmootherState = { sin: 0, cos: 0, initialized: false };

/**
 * Exponential low-pass filter over the heading's sin/cos components, not
 * the raw degrees — raw magnetometer readings jitter, and a naive average
 * of two angles either side of the 0/360 seam (e.g. 350 and 10) gives 180
 * (the opposite direction) instead of 0. Averaging the unit-circle
 * components and taking atan2 avoids that (design-refresh-v3 Faz 13).
 */
export function smoothHeading(
  prev: CircularSmootherState,
  nextDeg: number,
  smoothingFactor = 0.3
): { value: number; state: CircularSmootherState } {
  const rad = (nextDeg * Math.PI) / 180;
  const sampleSin = Math.sin(rad);
  const sampleCos = Math.cos(rad);
  if (!prev.initialized) {
    return { value: nextDeg, state: { sin: sampleSin, cos: sampleCos, initialized: true } };
  }
  const sin = prev.sin + smoothingFactor * (sampleSin - prev.sin);
  const cos = prev.cos + smoothingFactor * (sampleCos - prev.cos);
  const angle = (Math.atan2(sin, cos) * 180) / Math.PI;
  return { value: (angle + 360) % 360, state: { sin, cos, initialized: true } };
}

/**
 * Angular distance travelled between the oldest and newest heading in a
 * rolling buffer, or null until that buffer actually spans `minWindowMs` —
 * design-refresh-v3 Faz 20 madde 3, added specifically to MEASURE a
 * real-device report of the compass drifting progressively over time
 * (not a fixed offset) instead of guessing at a cause. A fixed offset
 * would point to magnetic declination (deliberately NOT applied until
 * this is understood); a growing one points to the sensor fusion behind
 * `deviceorientationabsolute`/`absolute:true` not actually being
 * magnetometer-locked on that device — something no amount of smoothing
 * or flag-checking in this file can correct, only reveal.
 */
export function computeHeadingDrift(
  oldestHeadingDeg: number,
  newestHeadingDeg: number,
  spanMs: number,
  minWindowMs = 60_000
): number | null {
  if (spanMs < minWindowMs) return null;
  return getAngularDifference(oldestHeadingDeg, newestHeadingDeg);
}

function circularMean(headingsDeg: number[]): number {
  let sin = 0;
  let cos = 0;
  for (const h of headingsDeg) {
    const rad = (h * Math.PI) / 180;
    sin += Math.sin(rad);
    cos += Math.cos(rad);
  }
  const angle = (Math.atan2(sin, cos) * 180) / Math.PI;
  return (angle + 360) % 360;
}

export interface HeadingStats {
  /** Plain numeric min/max — can look huge (e.g. 2 and 358) for headings
   * that are actually close together once you cross the 0/360 seam; use
   * `spread` for the physically-true distance, not these. */
  min: number;
  max: number;
  average: number;
  /** Max pairwise angular difference (circular-safe) — the trustworthy "how spread out" number. */
  spread: number;
}

/**
 * design-refresh-v3 Faz 21 madde 2 — the debug panel needs to tell a fixed
 * offset (could be magnetic declination) apart from a growing one (sensor
 * fusion issue), and a single "current heading" number can't do that.
 */
export function computeHeadingStats(headingsDeg: number[]): HeadingStats | null {
  if (headingsDeg.length === 0) return null;
  let spread = 0;
  for (let i = 0; i < headingsDeg.length; i++) {
    for (let j = i + 1; j < headingsDeg.length; j++) {
      spread = Math.max(spread, getAngularDifference(headingsDeg[i], headingsDeg[j]));
    }
  }
  return {
    min: Math.min(...headingsDeg),
    max: Math.max(...headingsDeg),
    average: circularMean(headingsDeg),
    spread,
  };
}

export type DriftCharacter = 'insufficient-data' | 'stable' | 'monotonic' | 'oscillating';

// Below this, a delta is noise (hand tremor / quantization), not real movement.
const MEANINGFUL_DELTA_DEG = 0.5;
// A dominant-sign fraction at or above this counts as "mostly one direction".
const MONOTONIC_DOMINANCE_RATIO = 0.7;

/**
 * Whether consecutive headings mostly move the same way (a real, growing
 * drift) or flip back and forth (sensor noise/jitter, not drift) — a plain
 * "did the number change" can't distinguish those, but the SIGN of each
 * step can (design-refresh-v3 Faz 21 madde 2, explicit user requirement:
 * "ardışık farkların işareti çoğunlukla aynı mı, yoksa değişken mi").
 */
export function classifyDriftCharacter(headingsDeg: number[]): DriftCharacter {
  if (headingsDeg.length < 3) return 'insufficient-data';

  let positive = 0;
  let negative = 0;
  for (let i = 1; i < headingsDeg.length; i++) {
    // Signed shortest-way delta, wrap-safe (350 -> 358 -> 1 reads as +3, +3, not -352, +1).
    const delta = ((headingsDeg[i] - headingsDeg[i - 1] + 540) % 360) - 180;
    if (delta > MEANINGFUL_DELTA_DEG) positive++;
    else if (delta < -MEANINGFUL_DELTA_DEG) negative++;
  }

  const total = positive + negative;
  if (total === 0) return 'stable';
  return Math.max(positive, negative) / total >= MONOTONIC_DOMINANCE_RATIO ? 'monotonic' : 'oscillating';
}

const BROWSER_TOKEN_PATTERN = /(Chrome|Firefox|Safari|Edg|CriOS|FxiOS|Version)\/[\d._]+/;

/** Short "platform · browser" label for the debug panel — not the full raw user agent string. */
export function summarizePlatform(userAgent: string): string {
  const platformMatch = userAgent.match(/\(([^)]+)\)/);
  const platform = platformMatch ? platformMatch[1].trim() : 'bilinmiyor';
  const browserMatch = userAgent.match(BROWSER_TOKEN_PATTERN);
  const browser = browserMatch ? browserMatch[0] : 'bilinmiyor';
  return `${platform} · ${browser}`;
}

export type ActiveEventType =
  | 'deviceorientationabsolute'
  | 'deviceorientation'
  | 'webkitCompassHeading'
  | 'none';

/**
 * Which source actually produced the heading — webkitCompassHeading takes
 * priority whenever present (matches computeHeadingFromOrientationEvent's
 * own precedence), otherwise whichever event literally fired.
 */
export function determineActiveEventType(
  webkitCompassHeading: number | undefined,
  eventSourceName: 'deviceorientationabsolute' | 'deviceorientation'
): ActiveEventType {
  return Number.isFinite(webkitCompassHeading) ? 'webkitCompassHeading' : eventSourceName;
}

export interface TurnInstruction {
  /** 0-180, the short way around. */
  degrees: number;
  direction: 'right' | 'left' | 'aligned';
}

/**
 * Which way to physically turn (and how far, the short way around) to go
 * from the current heading to the qibla bearing.
 */
export function getTurnInstruction(bearing: number, heading: number, toleranceDeg = 5): TurnInstruction {
  if (isAlignedWithBearing(bearing, heading, toleranceDeg)) {
    return { degrees: 0, direction: 'aligned' };
  }
  // Signed short-way delta, normalized to (-180, 180]. Positive means the
  // target is clockwise of the current heading (turn right).
  const signedDelta = ((bearing - heading + 540) % 360) - 180;
  return {
    degrees: Math.round(Math.abs(signedDelta)),
    direction: signedDelta > 0 ? 'right' : 'left',
  };
}
