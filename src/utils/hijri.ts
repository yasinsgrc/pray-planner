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
 * Modern Islamic tabular hijri conversion algorithm tuned for Turkish Diyanet calendar alignment
 */
export function getHijriDate(date: Date = new Date()): HijriDateInfo {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();

  let m = month + 1;
  let y = year;
  if (m < 3) {
    y -= 1;
    m += 12;
  }

  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const jd =
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    b -
    1524.5;

  const islamicEpoch = 1948439.5;
  const daysSinceEpoch = jd - islamicEpoch;

  const cycle = Math.floor(daysSinceEpoch / 10631);
  const remainingDays = daysSinceEpoch - cycle * 10631;

  let yearInCycle = Math.floor((remainingDays - 0.1388) / 354.366);
  if (yearInCycle < 0) yearInCycle = 0;

  const hijriYear = cycle * 30 + yearInCycle + 1;

  // Approximate day within the Islamic year
  let dayInHijriYear = Math.round(remainingDays - yearInCycle * 354.366);

  let hijriMonth = 0;
  const monthLengths = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];

  while (hijriMonth < 12 && dayInHijriYear > monthLengths[hijriMonth]) {
    dayInHijriYear -= monthLengths[hijriMonth];
    hijriMonth++;
  }

  if (hijriMonth >= 12) {
    hijriMonth = 11;
  }

  const hDay = Math.max(1, Math.min(30, Math.floor(dayInHijriYear)));
  const hMonthName = HIJRI_MONTHS[hijriMonth] || 'Muharrem';

  return {
    day: hDay,
    monthName: hMonthName,
    year: hijriYear,
    formatted: `${hDay} ${hMonthName} ${hijriYear}`,
  };
}
