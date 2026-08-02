import React from 'react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { PRAYER_ICON_COMPONENTS } from './prayerIcons';
import { formatTime } from '../utils/formatTime';

interface DialLegendProps {
  schedule: DayPrayerSchedule;
}

/**
 * Fixed 6-column row below the dial — every prayer's icon + time, always
 * visible. Replaces the earlier floating on-ring chips (SunArcDial), which
 * measured overlapping each other and running off the edge of the screen
 * in a real browser. A grid with 6 equal columns inside the app's own
 * max-width shell cannot overflow by construction.
 */
export const DialLegend: React.FC<DialLegendProps> = ({ schedule }) => {
  const { dayCyclePrayers, nextPrayer } = schedule;

  return (
    <div className="grid grid-cols-6 gap-1 w-full mt-3">
      {dayCyclePrayers.map((p) => {
        const isNext = p.name === nextPrayer.name;
        const Icon = PRAYER_ICON_COMPONENTS[p.name];
        return (
          <div key={p.name} className="flex flex-col items-center gap-0.5 text-center">
            <Icon
              weight={isNext ? 'fill' : 'regular'}
              className="w-3.5 h-3.5"
              style={{ color: isNext ? 'var(--accent-ink)' : 'var(--mist)' }}
            />
            <span
              className="font-numbers text-[11px] leading-tight"
              style={{ color: isNext ? 'var(--accent-ink)' : 'var(--mist)', fontWeight: isNext ? 700 : 500 }}
            >
              {formatTime(p.dateObj)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
