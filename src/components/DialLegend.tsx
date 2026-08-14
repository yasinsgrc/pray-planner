import React from 'react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { PRAYER_ICON_COMPONENTS } from './prayerIcons';
import { formatTime } from '../utils/formatTime';
import { isFridayInZone } from '../utils/timezone';

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
  const { dayCyclePrayers, activePrayer, nextPrayer, resolvedTimeZone } = schedule;

  return (
    <div className="grid grid-cols-6 gap-1 w-full mt-2 relative z-10" data-testid="dial-legend">
      {dayCyclePrayers.map((p) => {
        const isActive = p.name === activePrayer.name;
        const isNext = !isActive && p.name === nextPrayer.name;
        const state = isActive ? 'active' : isNext ? 'next' : 'other';
        // Şu anki vakit --accent-ink ile (App.tsx tarafından aktif vaktin
        // rengine bağlanır) güçlü vurgu alır; sıradaki vakit aynı rengi
        // paylaşmasın diye --ink ile daha zayıf, orta ağırlıkta işaretlenir.
        const color = isActive ? 'var(--accent-ink)' : isNext ? 'var(--ink)' : 'var(--mist)';
        const fontWeight = isActive ? 700 : isNext ? 600 : 500;
        const Icon = PRAYER_ICON_COMPONENTS[p.name];
        // Cuma namazı Öğle'nin yerini alır — yalnızca bu şeridin görünen
        // adı için; p.label (ör. "Öğle vaktindesiniz") her gün aynı kalır,
        // çünkü bu değişiklik yalnızca burada istendi (ikonlar/saatler/
        // halka kapsam dışı). Gün, öğle vaktinin kendi zaman damgasının
        // hedef saat diliminde okunmasıyla belirlenir — imsaktan önceki
        // saatlerde dün'ün öğle'si gösterildiğinde de doğru günü verir.
        const displayName = p.name === 'ogle' && isFridayInZone(p.dateObj, resolvedTimeZone) ? 'Cuma' : p.label;
        return (
          <div
            key={p.name}
            data-state={state}
            data-prayer={p.name}
            className="flex flex-col items-center gap-px text-center"
          >
            <span
              className="text-[8px] font-medium uppercase tracking-wide leading-none"
              style={{ color }}
            >
              {displayName}
            </span>
            <Icon weight={isActive ? 'fill' : 'regular'} className="w-3.5 h-3.5" style={{ color }} />
            <span
              className="font-numbers text-[11px] leading-tight"
              style={{ color, fontWeight }}
            >
              {formatTime(p.dateObj, resolvedTimeZone)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
