import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';

interface SunArcDialProps {
  schedule: DayPrayerSchedule;
  size?: number;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * "Gün Kavisi Kadranı" — the app's one signature element. A full
 * imsak-to-imsak day cycle (not a "time to next prayer" progress bar): six
 * ticks at each prayer's true solar angle, an elapsed arc colored through
 * the day's six accent tones, and a marker for the current moment.
 */
export const SunArcDial: React.FC<SunArcDialProps> = ({ schedule, size = 288 }) => {
  const prefersReducedMotion = useReducedMotion();
  const { dayCycleStart, dayCycleEnd, dayCyclePrayers, dayProgress, activePrayer } = schedule;

  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const totalMs = dayCycleEnd.getTime() - dayCycleStart.getTime();
  const segments = dayCyclePrayers.map((prayer, index) => {
    const nextTime =
      index < dayCyclePrayers.length - 1 ? dayCyclePrayers[index + 1].dateObj : dayCycleEnd;
    const startFrac = (prayer.dateObj.getTime() - dayCycleStart.getTime()) / totalMs;
    const endFrac = (nextTime.getTime() - dayCycleStart.getTime()) / totalMs;
    const coloredFrac = Math.max(0, Math.min(endFrac, dayProgress) - startFrac);
    return {
      name: prayer.name,
      startFrac,
      coloredLength: coloredFrac * circumference,
    };
  });

  const isNight = activePrayer.name === 'imsak' || activePrayer.name === 'yatsi';
  const markerAngle = dayProgress * 360;

  // Kerahet windows are always computed against "today" (see
  // prayerCalculator's kerahetWindows), so during the pre-fajr wrap case
  // (dayCycleStart = yesterday's fajr) they fall outside this cycle's
  // [0,1] range and are naturally filtered out below.
  const kerahetHatches = schedule.kerahetTimes
    .map((k) => ({
      type: k.type,
      startFrac: (k.startTime.getTime() - dayCycleStart.getTime()) / totalMs,
      endFrac: (k.endTime.getTime() - dayCycleStart.getTime()) / totalMs,
    }))
    .filter((k) => k.endFrac > 0 && k.startFrac < 1);

  return (
    <svg
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
      className="transform -rotate-90 drop-shadow-sm"
    >
      {/* Arka plan: kalan (henüz gelmemiş) kısım */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke="var(--mist)"
        strokeOpacity={0.22}
        strokeWidth={strokeWidth}
        fill="transparent"
      />

      {/*
        Çentikler ve işaretçi, yay segmentleriyle AYNI referans noktasından
        (yerel 3 o'clock -- SVG <circle> path'inin doğal başlangıcı) rotate
        edilmeli; aksi halde üst svg'nin -rotate-90 CSS dönüşümüyle
        birleştiğinde 90° kayarlar. Bu yüzden hepsi (cx + radius, cy)
        etrafında, yerel 12 o'clock değil, konumlanıyor.
      */}
      {segments.map((seg) => (
        <line
          key={`tick-${seg.name}`}
          x1={cx + radius + 4}
          y1={cy}
          x2={cx + radius + 12}
          y2={cy}
          stroke={`var(--v-${seg.name})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          transform={`rotate(${seg.startFrac * 360} ${cx} ${cy})`}
        />
      ))}

      {/* Geçen kısım: her vakit aralığı kendi rengiyle, o ana kadar */}
      {segments.map((seg) =>
        seg.coloredLength > 0.5 ? (
          <motion.circle
            key={`arc-${seg.name}`}
            cx={cx}
            cy={cy}
            r={radius}
            stroke={`var(--v-${seg.name})`}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            fill="transparent"
            transform={`rotate(${seg.startFrac * 360} ${cx} ${cy})`}
            initial={prefersReducedMotion ? false : { strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${seg.coloredLength} ${circumference - seg.coloredLength}` }}
            transition={{ duration: 0.9, ease: EASE }}
          />
        ) : null
      )}

      {/* Kerahet pencereleri: yay üzerinde tarama deseni (sakin, alarm kutusu değil) */}
      {kerahetHatches.map((k) => {
        const startDeg = Math.max(0, k.startFrac) * 360;
        const endDeg = Math.min(1, k.endFrac) * 360;
        const tickCount = Math.max(2, Math.round((endDeg - startDeg) / 4));
        return (
          <g key={`kerahet-${k.type}`}>
            {Array.from({ length: tickCount + 1 }, (_, i) => startDeg + (i * (endDeg - startDeg)) / tickCount).map(
              (deg, i) => (
                <line
                  key={i}
                  x1={cx + radius - 4}
                  y1={cy}
                  x2={cx + radius + 4}
                  y2={cy}
                  stroke="var(--mist)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  transform={`rotate(${deg} ${cx} ${cy})`}
                />
              )
            )}
          </g>
        );
      })}

      {/* Şu anki an işaretçisi: gündüz dolu daire, gece hilal */}
      <g transform={`rotate(${markerAngle} ${cx} ${cy})`}>
        {isNight ? (
          <>
            <circle cx={cx + radius} cy={cy} r={8} fill="var(--gold)" />
            <circle cx={cx + radius - 3} cy={cy - 3} r={7} fill="var(--paper)" />
          </>
        ) : (
          <circle cx={cx + radius} cy={cy} r={8} fill="var(--gold)" stroke="white" strokeWidth={2} />
        )}
      </g>
    </svg>
  );
};
