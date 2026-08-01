import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { polarPoint, arcPath } from '../utils/dialGeometry';

interface SunArcDialProps {
  schedule: DayPrayerSchedule;
  size?: number;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * "Gün Kavisi Kadranı" — the app's one signature element. A full
 * imsak-to-imsak day cycle (not a "time to next prayer" progress bar): an
 * elapsed arc colored through the day's six accent tones (each segment
 * separated by a small gap instead of unlabeled outer ticks), a small dot
 * per prayer at its true solar angle, and a marker for the current moment.
 * Prayer names/times live in the fixed DialLegend row below the dial, not
 * as floating chips on the ring — floating chips at variable angles can't
 * be made to never overlap each other or the ring by construction, and
 * measurement in a real browser confirmed they didn't (design-refresh-v3
 * Faz 1: "tam etiket modu" / next-prayer chip removed for exactly this
 * reason).
 */
export const SunArcDial: React.FC<SunArcDialProps> = ({ schedule, size = 288 }) => {
  const prefersReducedMotion = useReducedMotion();
  const { dayCycleStart, dayCycleEnd, dayCyclePrayers, dayProgress, activePrayer, nextPrayer, kerahetTimes } =
    schedule;

  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const gapFrac = 3 / circumference; // 3px gap at the start of each segment

  const totalMs = dayCycleEnd.getTime() - dayCycleStart.getTime();
  const segments = dayCyclePrayers.map((prayer, index) => {
    const nextTime = index < dayCyclePrayers.length - 1 ? dayCyclePrayers[index + 1].dateObj : dayCycleEnd;
    const trueStart = (prayer.dateObj.getTime() - dayCycleStart.getTime()) / totalMs;
    const trueEnd = (nextTime.getTime() - dayCycleStart.getTime()) / totalMs;
    const renderStart = Math.min(trueStart + gapFrac, trueEnd);
    const elapsedEnd = Math.max(renderStart, Math.min(trueEnd, dayProgress));
    return {
      name: prayer.name,
      trueStart,
      trueEnd,
      renderStart,
      elapsedEnd,
      hasElapsed: elapsedEnd > renderStart,
      isNext: prayer.name === nextPrayer.name,
    };
  });

  const isNight = activePrayer.name === 'imsak' || activePrayer.name === 'yatsi';
  const markerPoint = polarPoint(cx, cy, radius, dayProgress);

  // Kerahet windows are always computed against "today" (see
  // prayerCalculator's kerahetWindows), so during the pre-fajr wrap case
  // (dayCycleStart = yesterday's fajr) they fall outside this cycle's
  // [0,1] range and are naturally filtered out below.
  const kerahetArcs = kerahetTimes
    .map((k) => ({
      type: k.type,
      startFrac: (k.startTime.getTime() - dayCycleStart.getTime()) / totalMs,
      endFrac: (k.endTime.getTime() - dayCycleStart.getTime()) / totalMs,
    }))
    .filter((k) => k.endFrac > 0 && k.startFrac < 1);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ overflow: 'visible' }} className="drop-shadow-sm">
        <defs>
          <mask id="dial-crescent-mask">
            <circle cx={markerPoint.x} cy={markerPoint.y} r={8} fill="white" />
            <circle cx={markerPoint.x + 3} cy={markerPoint.y - 3} r={7} fill="black" />
          </mask>
        </defs>

        {/* Arka plan: kalan (henüz gelmemiş) kısım, segment başına aynı boşluklarla */}
        {segments.map((seg) => (
          <path
            key={`base-${seg.name}`}
            d={arcPath(cx, cy, radius, seg.renderStart, seg.trueEnd)}
            stroke="var(--mist)"
            strokeOpacity={0.22}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            fill="none"
          />
        ))}

        {/* Geçen kısım: her vakit aralığı kendi rengiyle, o ana kadar */}
        {segments.map((seg) =>
          seg.hasElapsed ? (
            <motion.path
              key={`arc-${seg.name}`}
              d={arcPath(cx, cy, radius, seg.renderStart, seg.elapsedEnd)}
              stroke={`var(--v-${seg.name})`}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              fill="none"
              initial={prefersReducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: EASE }}
            />
          ) : null
        )}

        {/*
          Kerahet pencereleri: halkanın içinde ince bir yay (radius - 7),
          renkli yayı örtmeden yanında durur. Önceki <pattern> tabanlı
          tarama denemesi büyütülmüş ekranda bulanık gri bir leke gibi
          çıkıyordu (gerçek tarayıcıda ölçüldü) — düz, ince, yarı saydam
          bir yayla değiştirildi (design-refresh-v3 Faz 1).
        */}
        {kerahetArcs.map((k) => (
          <path
            key={`kerahet-${k.type}`}
            d={arcPath(cx, cy, radius - 7, Math.max(0, k.startFrac), Math.min(1, k.endFrac))}
            stroke="var(--mist)"
            strokeOpacity={0.45}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        ))}

        {/* Her vaktin açısında küçük bir nokta; sıradaki vakit vurgulu */}
        {segments.map((seg) => {
          const dot = polarPoint(cx, cy, radius, seg.trueStart);
          return (
            <circle
              key={`dot-${seg.name}`}
              cx={dot.x}
              cy={dot.y}
              r={seg.isNext ? 4 : 2.5}
              fill={seg.isNext ? 'var(--accent)' : 'var(--paper)'}
              stroke={seg.isNext ? 'white' : `var(--v-${seg.name})`}
              strokeWidth={seg.isNext ? 1.5 : 1.5}
            />
          );
        })}

        {/* Şu anki an işaretçisi: gündüz dolu daire (--accent), gece hilal (mask ile gerçek kesik) */}
        {isNight ? (
          <circle
            cx={markerPoint.x}
            cy={markerPoint.y}
            r={8}
            fill="var(--accent)"
            mask="url(#dial-crescent-mask)"
          />
        ) : (
          <circle cx={markerPoint.x} cy={markerPoint.y} r={8} fill="var(--accent)" stroke="white" strokeWidth={2} />
        )}
      </svg>
    </div>
  );
};
