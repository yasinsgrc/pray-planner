export interface OrientationEventLike {
  webkitCompassHeading?: number;
  alpha: number | null;
}

export function computeHeadingFromOrientationEvent(
  event: OrientationEventLike
): number | null {
  if (typeof event.webkitCompassHeading === 'number') {
    return event.webkitCompassHeading;
  }
  if (event.alpha === null) {
    return null;
  }
  return (360 - event.alpha + 360) % 360;
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
