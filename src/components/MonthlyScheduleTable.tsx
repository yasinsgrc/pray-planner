import React, { useMemo, useState } from 'react';
import { FadeIn } from './FadeIn';
import { CaretLeftIcon, CaretRightIcon, CalendarDotsIcon } from './icons';
import { AppSettings, LocationItem, PrayerName } from '../types';
import { buildMonthlySchedule, dateKeyFor } from '../utils/monthlySchedule';
import { getCalendarDateInZone } from '../utils/timezone';

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

// Full names are read out via sr-only text; the visible glyphs below stay
// short on purpose — this table's columns must fit a 390px viewport with a
// fixed table layout and no horizontal scroll (this app's established
// convention, see the Zikirmatik dhikr-chip row: horizontal scroll was
// treated as a bug to fix, not an accepted pattern, design-refresh-v3 Faz 2 F3).
const SHORT_PRAYER_LABEL: Record<PrayerName, string> = {
  imsak: 'İm',
  gunes: 'Gün',
  ogle: 'Öğ',
  ikindi: 'İk',
  aksam: 'Ak',
  yatsi: 'Ya',
};

interface MonthlyScheduleTableProps {
  location: LocationItem;
  calculationMethod: AppSettings['calculationMethod'];
  today: Date;
  timeZone: string;
}

export const MonthlyScheduleTable: React.FC<MonthlyScheduleTableProps> = ({
  location,
  calculationMethod,
  today,
  timeZone,
}) => {
  const todayCal = useMemo(() => getCalendarDateInZone(today, timeZone), [today, timeZone]);
  const todayKey = dateKeyFor(todayCal.year, todayCal.month, todayCal.day);

  const [viewed, setViewed] = useState(() => ({ year: todayCal.year, month: todayCal.month }));

  const monthlySchedule = useMemo(
    () => buildMonthlySchedule(location, calculationMethod, viewed.year, viewed.month),
    [location, calculationMethod, viewed.year, viewed.month]
  );

  const goPrevMonth = () =>
    setViewed((v) => (v.month === 1 ? { year: v.year - 1, month: 12 } : { year: v.year, month: v.month - 1 }));
  const goNextMonth = () =>
    setViewed((v) => (v.month === 12 ? { year: v.year + 1, month: 1 } : { year: v.year, month: v.month + 1 }));

  return (
    <FadeIn delay={0.1} className="mt-2 p-4 rounded-2xl bg-card/70 border border-hairline/50">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDotsIcon className="w-4 h-4 text-gold-ink shrink-0" />
        <h3 className="text-sm font-bold text-ink">Aylık Vakit Listesi</h3>
      </div>

      <div className="flex items-center justify-center gap-1 mb-2">
        <button
          type="button"
          onClick={goPrevMonth}
          aria-label="Önceki ay"
          className="w-11 h-11 flex items-center justify-center rounded-full text-mist hover:text-gold-ink hover:bg-gold/10 transition-colors cursor-pointer"
        >
          <CaretLeftIcon className="w-4 h-4" />
        </button>
        <span className="font-numbers text-sm font-bold text-ink min-w-[9ch] text-center">
          {MONTH_NAMES_TR[viewed.month - 1]} {viewed.year}
        </span>
        <button
          type="button"
          onClick={goNextMonth}
          aria-label="Sonraki ay"
          className="w-11 h-11 flex items-center justify-center rounded-full text-mist hover:text-gold-ink hover:bg-gold/10 transition-colors cursor-pointer"
        >
          <CaretRightIcon className="w-4 h-4" />
        </button>
      </div>

      {/* -mx-4 bleeds back out to the card's own edges (cancelling the card's
          p-4) so the fixed-layout table gets the card's full width to work
          with — every extra pixel matters at a 390px viewport with 7 columns. */}
      <div className="-mx-4">
        <table className="w-full table-fixed border-collapse text-[10px]">
          <caption className="sr-only">
            {MONTH_NAMES_TR[viewed.month - 1]} {viewed.year} aylık vakit listesi ve hicri tarihler
          </caption>
          <colgroup>
            <col style={{ width: '22%' }} />
            {monthlySchedule.days[0]?.prayers.map((p) => <col key={p.name} style={{ width: `${78 / 6}%` }} />)}
          </colgroup>
          <thead>
            <tr className="border-b border-hairline/50">
              <th scope="col" className="text-left font-semibold text-mist py-1.5 pl-4">Tarih</th>
              {monthlySchedule.days[0]?.prayers.map((p) => (
                <th key={p.name} scope="col" className="text-right font-semibold text-mist py-1.5 pr-1 last:pr-4">
                  <span aria-hidden="true">{SHORT_PRAYER_LABEL[p.name]}</span>
                  <span className="sr-only">{p.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthlySchedule.days.map((day) => {
              const isToday = day.dateKey === todayKey;
              return (
                <tr key={day.dateKey} className={`border-b border-hairline/20 ${isToday ? 'bg-gold/10' : ''}`}>
                  <th scope="row" className="text-left py-1 pl-4 font-normal">
                    <div className={`font-numbers font-bold ${isToday ? 'text-gold-ink' : 'text-ink'}`}>
                      {day.date.getDate()} {MONTH_NAMES_TR[viewed.month - 1].slice(0, 3)}
                    </div>
                    <div className="text-mist">
                      {day.hijri.day} {day.hijri.monthName}
                    </div>
                  </th>
                  {day.prayers.map((p) => (
                    <td key={p.name} className="text-right font-numbers text-ink py-1 pr-1 last:pr-4">
                      {p.timeString}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </FadeIn>
  );
};
