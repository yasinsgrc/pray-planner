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
 * Ümmü'l-Kura resmi takvim verisine (hijri-converter) dayanır. Diyanet'in
 * resmi açıklamasından ±1 gün farklı olabilir; kullanıcıya bu bilgi
 * SpiritualSettings ekranındaki bilgi kartında ayrıca gösterilir.
 */
export function getHijriDate(date: Date = new Date()): HijriDateInfo {
  const { hy, hm, hd } = toHijri(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const monthName = HIJRI_MONTHS[hm - 1] || 'Muharrem';

  return {
    day: hd,
    monthName,
    year: hy,
    formatted: `${hd} ${monthName} ${hy}`,
  };
}
