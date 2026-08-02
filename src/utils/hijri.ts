import { toHijri } from 'hijri-converter';
import { HijriDateInfo } from '../types';

const HIJRI_MONTHS = [
  'Muharrem',
  'Safer',
  'Rebiülevvel',
  'Rebiülahir',
  'Cemaziyelevvel',
  'Cemaziyelahir',
  'Recep',
  'Şaban',
  'Ramazan',
  'Şevval',
  'Zilkade',
  'Zilhicce',
];

/**
 * The Gregorian calendar day at `date`, as read in `timeZone` — `Date`'s
 * own getFullYear/getMonth/getDate always read the *device's* local zone,
 * which is wrong whenever the selected prayer location is in a different
 * zone (design-refresh-v3 Faz 4 F3): a user in İstanbul with Mekke
 * selected past midnight there but not yet midnight locally would get
 * yesterday's Hijri date.
 */
function getCalendarDateInZone(date: Date, timeZone?: string): { year: number; month: number; day: number } {
  if (!timeZone) {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/**
 * Ümmü'l-Kura resmi takvim verisine (hijri-converter) dayanır. Diyanet'in
 * resmi açıklamasından ±1 gün farklı olabilir; kullanıcıya bu bilgi
 * SpiritualSettings ekranındaki bilgi kartında ayrıca gösterilir.
 */
export function getHijriDate(date: Date = new Date(), timeZone?: string): HijriDateInfo {
  const { year, month, day } = getCalendarDateInZone(date, timeZone);
  const { hy, hm, hd } = toHijri(year, month, day);
  const monthName = HIJRI_MONTHS[hm - 1] || 'Muharrem';

  return {
    day: hd,
    monthName,
    year: hy,
    formatted: `${hd} ${monthName} ${hy}`,
  };
}
