import { PrayerName } from '../types';

/**
 * Long enough that a background tab's throttled once-a-minute timer still
 * catches a real transition, short enough that nothing but a real
 * transition fits in it.
 */
const EZAN_TRIGGER_WINDOW_MS = 3 * 60 * 1000;

/**
 * Whether the foreground ezan should play now. A change of active prayer
 * alone isn't enough: switching location, or the app returning from hours
 * in the background, also changes it — long after that prayer actually
 * began. Only a prayer that began within the last few minutes counts.
 */
export function shouldPlayEzanOnTransition(input: {
  previousName: PrayerName | null;
  activeName: PrayerName;
  activeStartMs: number;
  nowMs: number;
}): boolean {
  const { previousName, activeName, activeStartMs, nowMs } = input;
  if (previousName === null || previousName === activeName) return false;
  const sinceStart = nowMs - activeStartMs;
  return sinceStart >= 0 && sinceStart < EZAN_TRIGGER_WINDOW_MS;
}
