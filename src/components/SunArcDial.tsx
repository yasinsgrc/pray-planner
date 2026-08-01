import React, { useState, useRef } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { PRAYER_ICON_COMPONENTS } from './prayerIcons';
import { formatTime } from '../utils/formatTime';
import { polarPoint, arcPath } from '../utils/dialGeometry';

interface SunArcDialProps {
  schedule: DayPrayerSchedule;
  size?: number;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const REVEAL_DURATION_MS = 3000;

/**
 * "Gün Kavisi Kadranı" — the app's one signature element. A full
 * imsak-to-imsak day cycle (not a "time to next prayer" progress bar): an
 * elapsed arc colored through the day's six accent tones (each segment
 * separated by a small gap instead of unlabeled outer ticks), a marker for
 * the current moment, and on tap, all six prayer names/times briefly
 * labeled on the ring itself.
 */
export const SunArcDial: React.FC<SunArcDialProps> = ({ schedule, size = 288 }) => {
  const prefersReducedMotion = useReducedMotion();
  const { dayCycleStart, dayCycleEnd, dayCyclePrayers, dayProgress, activePrayer, nextPrayer, kerahetTimes } =
    schedule;
  const [showAllLabels, setShowAllLabels] = useState(false);
  const revealTimeoutRef = useRef<number | null>(null);

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
    };
  });

  const isNight = activePrayer.name === 'imsak' || activePrayer.name === 'yatsi';
  const markerPoint = polarPoint(cx, cy, radius, dayProgress);

  // Kerahet windows are always computed against "today" (see
  // prayerCalculator's kerahetWindows), so during the pre-fajr wrap case
  // (dayCycleStart = yesterday's fajr) they fall outside this cycle's
  // [0,1] range and are naturally filtered out below.
  const kerahetHatches = kerahetTimes
    .map((k) => ({
      type: k.type,
      startFrac: (k.startTime.getTime() - dayCycleStart.getTime()) / totalMs,
      endFrac: (k.endTime.getTime() - dayCycleStart.getTime()) / totalMs,
    }))
    .filter((k) => k.endFrac > 0 && k.startFrac < 1);

  const chipRadius = radius + 26;

  // At most 2 named things at once (marker + next-prayer chip) unless the
  // user taps the dial, which briefly names all six.
  const labelChips = showAllLabels
    ? dayCyclePrayers.map((p) => ({
        name: p.name,
        label: p.label,
        time: p.dateObj,
        frac: Math.min(1, Math.max(0, (p.dateObj.getTime() - dayCycleStart.getTime()) / totalMs)),
      }))
    : [
        {
          name: nextPrayer.name,
          label: nextPrayer.label,
          time: nextPrayer.dateObj,
          frac: Math.min(1, Math.max(0, (nextPrayer.dateObj.getTime() - dayCycleStart.getTime()) / totalMs)),
        },
      ];

  const handleDialTap = () => {
    setShowAllLabels(true);
    if (revealTimeoutRef.current !== null) {
      window.clearTimeout(revealTimeoutRef.current);
    }
    revealTimeoutRef.current = window.setTimeout(() => setShowAllLabels(false), REVEAL_DURATION_MS);
  };

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

        {/* Kerahet pencereleri: yay üzerinde tarama deseni (sakin, alarm kutusu değil) */}
        {kerahetHatches.map((k) => {
          const start = Math.max(0, k.startFrac);
          const end = Math.min(1, k.endFrac);
          const hatchCount = Math.max(2, Math.round((end - start) * 90));
          return (
            <g key={`kerahet-${k.type}`}>
              {Array.from({ length: hatchCount + 1 }, (_, i) => start + (i * (end - start)) / hatchCount).map(
                (frac, i) => {
                  const inner = polarPoint(cx, cy, radius - 4, frac);
                  const outer = polarPoint(cx, cy, radius + 4, frac);
                  return (
                    <line
                      key={i}
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      stroke="var(--mist)"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  );
                }
              )}
            </g>
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

      {/* Vakit çipleri: normalde yalnızca sıradaki vakit, dokununca hepsi — metin hep yatay */}
      <button
        type="button"
        onClick={handleDialTap}
        aria-label="Tüm vakit isimlerini göster"
        className="absolute inset-0 rounded-full cursor-pointer"
        style={{ background: 'transparent' }}
      />
      <AnimatePresence>
        {labelChips.map((chip) => {
          const pt = polarPoint(cx, cy, chipRadius, chip.frac);
          const ChipIcon = PRAYER_ICON_COMPONENTS[chip.name];
          return (
            <motion.div
              key={chip.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="absolute flex items-center gap-1 px-2 py-1 rounded-full bg-card border border-hairline text-[11px] font-medium text-ink shadow-sm whitespace-nowrap pointer-events-none"
              style={{ left: pt.x, top: pt.y, transform: 'translate(-50%, -50%)' }}
            >
              <ChipIcon className="w-3 h-3 text-gold" weight="duotone" />
              <span>
                {chip.label} {formatTime(chip.time)}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
