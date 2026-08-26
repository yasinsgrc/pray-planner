const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * 1-based day-of-year for `date`'s device-local calendar day. Built from
 * getFullYear/getMonth/getDate (not ms subtraction/division) so a DST
 * transition — which shifts ms-since-epoch within the same local day —
 * never shifts the result.
 */
export function dayOfYear(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  let total = day;
  for (let m = 0; m < month; m++) {
    total += DAYS_IN_MONTH[m];
    if (m === 1 && isLeapYear(year)) total += 1;
  }
  return total;
}

/** Which of `count` daily items (e.g. Esmâ-ül Hüsnâ names) is today's. */
export function esmaIndexFor(date: Date, count: number): number {
  if (count <= 0) return 0;
  return dayOfYear(date) % count;
}
