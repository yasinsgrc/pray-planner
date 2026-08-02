import { KerahetInfo } from '../types';
import { formatTime } from './formatTime';

export const KERAHET_SHORT_LABEL: Record<KerahetInfo['type'], string> = {
  gunes_sonrasi: 'İşrâk',
  ogle_oncesi: 'İstivâ',
  aksam_oncesi: 'Gurûb',
};

export function formatKerahetRange(k: KerahetInfo, timeZone?: string): string {
  return `${formatTime(k.startTime, timeZone)}–${formatTime(k.endTime, timeZone)}`;
}
