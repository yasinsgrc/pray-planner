import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { polarPoint, arcPath } from '../utils/dialGeometry';

interface SunArcDialProps {
  schedule: DayPrayerSchedule;
  size?: number;
}

const EASE = [0.16, 1, 0.3, 1] as const;

// Sıradaki vakit dot'u (r=4.5) ile "şu an" işaretçisi (r=9) vakit bu kadar
// (ms) yaklaştığında görsel olarak çakışıp tek bir blob gibi göründüğü için
// dot bu eşiğin altında gizlenir.
const NEXT_MARKER_MERGE_THRESHOLD_MS = 15 * 60 * 1000;

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
  const { dayCycleStart, dayCycleEnd, dayCyclePrayers, dayProgress, activePrayer, nextPrayer } = schedule;

  // Faz 26 — halka artık min-height:720px üstü viewport'larda 288'lik
  // viewBox'ı aşıp ~320px'e kadar render edilebiliyor (index.css'teki
  // .ring-metrics), bu da viewBox koordinatlarını otomatik olarak >1
  // oranında ölçekliyor; 5px'lik eski stroke o boyutlarda bile ince
  // okunuyordu — 6'ya çıkarıldı.
  const strokeWidth = 6;
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

  // Hilal (gece işaretçisi) geometrisi — sabit, local (0,0) merkezli bir
  // path: dış daire (R) artı ondan dx kadar +x'e ötelenmiş bir kesim
  // dairesi (r), evenodd ile kesiliyor. Görünürdeki "kesik" +x yerelinde
  // sabit kaldığı için, işaretçiyi markerPoint'e taşımadan önce +x'i
  // dial merkezinden DIŞA (radyal yöne) çeviren bir rotate() gerekiyor.
  // polarPoint'in theta'sı (fraction*360, saat 12'den saat yönünde) SVG
  // rotate() ile aynı yönü paylaşıyor: +x ekseni theta-90 derece
  // döndürüldüğünde tam theta yönünde (dışa) bakar.
  const crescentOuterR = strokeWidth * 0.85;
  const crescentInnerR = crescentOuterR * 0.82;
  const crescentCutOffset = crescentOuterR * 0.42;
  const crescentPath =
    `M 0,${-crescentOuterR} A ${crescentOuterR},${crescentOuterR} 0 1,0 0,${crescentOuterR} A ${crescentOuterR},${crescentOuterR} 0 1,0 0,${-crescentOuterR} Z ` +
    `M ${crescentCutOffset},${-crescentInnerR} A ${crescentInnerR},${crescentInnerR} 0 1,0 ${crescentCutOffset},${crescentInnerR} A ${crescentInnerR},${crescentInnerR} 0 1,0 ${crescentCutOffset},${-crescentInnerR} Z`;
  const crescentRotationDeg = dayProgress * 360 - 90;

  const nextSegment = segments.find((seg) => seg.isNext);
  const msUntilNextPrayer = nextSegment ? (nextSegment.trueStart - dayProgress) * totalMs : Infinity;
  const hideNextDot = msUntilNextPrayer < NEXT_MARKER_MERGE_THRESHOLD_MS;

  return (
    <div className="relative w-full h-full">
      {/* Faz 25 Commit 2 — `size` (default 288) is only the internal SVG
          coordinate space now (radius/cx/cy/stroke math below), not the
          rendered pixel footprint. The old width/height={size} attributes
          rendered a literal 288px SVG regardless of the parent's actual
          CSS size, so when Faz 24 Commit 5 shrank the ring shell to
          min(48vw,16dvh) (well under 288px on real phones) the ring
          overflowed its shell while the countdown text stayed correctly
          scoped to it. viewBox + percentage width/height makes the SVG
          fill whatever box its parent (MainCountdownRing's ring-shell div)
          provides, matching it exactly at every viewport. */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
        className="drop-shadow-sm"
        data-dial-marker={JSON.stringify({ r: radius, frac: dayProgress })}
      >
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

        {/* Her vaktin açısında küçük bir nokta; sıradaki vakit vurgulu */}
        {segments.map((seg) => {
          if (seg.isNext && hideNextDot) return null;
          const dot = polarPoint(cx, cy, radius, seg.trueStart);
          return (
            <circle
              key={`dot-${seg.name}`}
              data-next-prayer-dot={seg.isNext ? 'true' : undefined}
              cx={dot.x}
              cy={dot.y}
              r={seg.isNext ? 4.5 : 3}
              fill={seg.isNext ? 'var(--accent)' : 'var(--paper)'}
              stroke={seg.isNext ? 'white' : `var(--v-${seg.name})`}
              strokeWidth={seg.isNext ? 1.5 : 1.5}
            />
          );
        })}

        {/* Şu anki an işaretçisi: gündüz dolu daire (--accent), gece hilal.
            Hilal kendi lokal (0,0 merkezli) koordinatlarında sabit bir path —
            arc path'lerinden ve dot'lardan SONRA (DOM'da en son) render
            edilerek her zaman üstte kalır. Altındaki opak --paper daire, o
            noktadan geçen arc'ı kapatır (hilal path'i evenodd kesik
            içerdiğinden kesik bölgede arc rengi sızmasın diye). */}
        {isNight ? (
          <g transform={`translate(${markerPoint.x}, ${markerPoint.y}) rotate(${crescentRotationDeg})`}>
            <circle r={crescentOuterR} fill="var(--paper)" />
            <path data-crescent-shape="true" fillRule="evenodd" fill="var(--gold)" d={crescentPath} />
          </g>
        ) : (
          <circle cx={markerPoint.x} cy={markerPoint.y} r={9} fill="var(--accent)" stroke="white" strokeWidth={2} />
        )}
      </svg>
    </div>
  );
};
