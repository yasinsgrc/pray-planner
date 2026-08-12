import { KerahetInfo } from '../types';

export interface KerahetDialArc {
  type: KerahetInfo['type'];
  startFrac: number;
  endFrac: number;
  /** Active now, or starting within the next 15 minutes — the same
   * threshold as HomeContextSlot's "upcoming kerahet" rule
   * (design-refresh-v3 Faz 24 Commit 5). */
  isActiveOrUpcoming: boolean;
}

const UPCOMING_WINDOW_MS = 15 * 60 * 1000;

/**
 * Kerahet windows positioned as fractions of the dial's imsak-to-imsak day
 * cycle, plus whether each is "urgent" (active or about to start) — the
 * pure geometry/state SunArcDial.tsx renders as short arcs outside the ring
 * track (design-refresh-v3 Faz 24 Commit 6; restored in Faz 25 Commit 3
 * after a brief removal in 7b9e884, at higher stroke weight + verified
 * contrast). Extracted from the component so both are independently
 * testable without an SVG renderer.
 */
export function computeKerahetDialArcs(
  kerahetTimes: KerahetInfo[],
  dayCycleStart: Date,
  totalMs: number,
  now: Date
): KerahetDialArc[] {
  return kerahetTimes
    .map((k) => {
      const startFrac = (k.startTime.getTime() - dayCycleStart.getTime()) / totalMs;
      const endFrac = (k.endTime.getTime() - dayCycleStart.getTime()) / totalMs;
      const msUntilStart = k.startTime.getTime() - now.getTime();
      const isUpcoming = !k.isActiveNow && msUntilStart > 0 && msUntilStart <= UPCOMING_WINDOW_MS;
      return { type: k.type, startFrac, endFrac, isActiveOrUpcoming: k.isActiveNow || isUpcoming };
    })
    .filter((k) => k.endFrac > 0 && k.startFrac < 1);
}
