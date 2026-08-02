import { KerahetInfo } from '../types';
import { KERAHET_SHORT_LABEL } from '../data/strings';
import { formatTime } from './formatTime';

export { KERAHET_SHORT_LABEL };

export function formatKerahetRange(k: KerahetInfo, timeZone?: string): string {
  return `${formatTime(k.startTime, timeZone)}–${formatTime(k.endTime, timeZone)}`;
}
