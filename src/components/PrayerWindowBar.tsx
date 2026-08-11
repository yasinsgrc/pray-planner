import React from 'react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { computePrayerWindow } from '../utils/prayerWindow';
import { formatTime } from '../utils/formatTime';

interface PrayerWindowBarProps {
  schedule: DayPrayerSchedule;
  now: Date;
}

const GOLD_THRESHOLD_SECONDS = 30 * 60;

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours} sa ${minutes} dk sürüyor` : `${minutes} dk sürüyor`;
}

/**
 * "Bu namazı kılmak için ne kadar vaktim kaldı" sorusuna cevap — kadran
 * "bir sonraki vakte ne kadar var" sorusuna cevap veriyor, bu ikisi farklı
 * sorular (design-refresh-v3 Faz 22 Commit 2). KerahetStrip'in altında,
 * eski bento grid'in yerinde render edilir.
 */
export const PrayerWindowBar: React.FC<PrayerWindowBarProps> = ({ schedule, now }) => {
  const window = computePrayerWindow(schedule, now);
  const remainingSeconds = window.totalSeconds - window.elapsedSeconds;
  const isClosingSoon = remainingSeconds < GOLD_THRESHOLD_SECONDS;
  const remainingMinutes = Math.max(0, Math.ceil(remainingSeconds / 60));
  const percent = Math.round(window.elapsedRatio * 100);

  const startLabel = formatTime(new Date(window.startMs), schedule.resolvedTimeZone);
  const endLabel = formatTime(new Date(window.endMs), schedule.resolvedTimeZone);
  const fillColor = isClosingSoon ? 'var(--gold)' : 'var(--accent)';

  return (
    <div className="w-full mt-1 shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-label text-ink font-semibold">{schedule.activePrayer.label}</span>
        <span className="font-numbers text-label text-mist">
          {startLabel} → {endLabel}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${schedule.activePrayer.label} vaktinin ilerleyişi`}
        className="mt-1.5 h-1 w-full rounded-full bg-card overflow-hidden"
      >
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: fillColor }} />
      </div>

      <p className="mt-1 text-micro text-mist text-center">
        {isClosingSoon ? `Vaktin çıkmasına ${remainingMinutes} dk` : formatDuration(window.totalSeconds)}
      </p>
    </div>
  );
};
