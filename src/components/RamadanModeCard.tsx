import React from 'react';
import { motion } from 'motion/react';
import { MoonStarsIcon } from './icons';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { getRamadanInfo } from '../utils/religiousDaysSchedule';

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

interface RamadanModeCardProps {
  schedule: DayPrayerSchedule;
  /** Gerçek, saniye başı güncellenen an — schedule.date günlük önbelleğe alındığı için canlı geri sayım için buna değil, bu ayrı prop'a ihtiyaç var. */
  now: Date;
}

/**
 * Design-refresh-v3 Faz 19 Ekleme 6. Yalnızca Ramazan'da görünür, aktivasyon
 * madde 5'in DOĞRULANMIŞ religiousDays.ts verisine dayanır (hicri aritmetik
 * değil). Fıkhi hüküm (orucun bozulur/bozulmaz vb.) ÜRETİLMEZ — sadece
 * saat/gün bilgisi. Vakit hesaplama mantığına dokunulmadı: imsak/akşam
 * saatleri zaten var olan schedule.prayers'tan okunuyor.
 */
export const RamadanModeCard: React.FC<RamadanModeCardProps> = ({ schedule, now }) => {
  const ramadan = getRamadanInfo(now, schedule.resolvedTimeZone);
  if (!ramadan) return null;

  const imsak = schedule.prayers.find((p) => p.name === 'imsak');
  const aksam = schedule.prayers.find((p) => p.name === 'aksam');
  if (!imsak || !aksam) return null;

  let countdownLabel: string;
  let countdownValue: string;

  if (now < imsak.dateObj) {
    countdownLabel = 'Sahur bitimine (İmsak)';
    countdownValue = formatCountdown(imsak.dateObj.getTime() - now.getTime());
  } else if (now < aksam.dateObj) {
    countdownLabel = 'İftara';
    countdownValue = formatCountdown(aksam.dateObj.getTime() - now.getTime());
  } else {
    countdownLabel = 'Bugünün orucu tamamlandı';
    countdownValue = `Yarın İmsak: ${schedule.tomorrowImsakTime}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[var(--shell-w)] mx-auto px-4 mb-3"
    >
      <div className="p-4 rounded-2xl bg-card border border-hairline">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-label text-mist font-bold">
            <MoonStarsIcon className="w-3.5 h-3.5 text-gold-ink" />
            <span>Ramazan</span>
          </div>
          <span className="font-numbers text-[11px] font-bold text-gold-ink">
            {ramadan.dayNumber}. gün / {ramadan.totalDays}
          </span>
        </div>

        <div className="text-center py-1">
          <div className="text-[11px] text-mist">{countdownLabel}</div>
          <div className="font-numbers text-3xl font-extrabold text-ink mt-0.5">{countdownValue}</div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-hairline/50 text-sm">
          <div>
            <span className="text-mist">İmsak </span>
            <span className="font-numbers font-bold text-ink">{imsak.timeString}</span>
          </div>
          <div>
            <span className="text-mist">İftar </span>
            <span className="font-numbers font-bold text-ink">{aksam.timeString}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
