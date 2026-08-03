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
