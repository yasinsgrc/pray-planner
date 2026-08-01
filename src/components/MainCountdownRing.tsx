import React from 'react';
import { motion } from 'motion/react';
import { ClockIcon, WarningIcon, DeviceMobileIcon, CalendarDotsIcon } from '@phosphor-icons/react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';

interface MainCountdownRingProps {
  schedule: DayPrayerSchedule;
  onScrollToFlow: () => void;
  onOpenLiveActivity: () => void;
}

export const MainCountdownRing: React.FC<MainCountdownRingProps> = ({
  schedule,
  onScrollToFlow,
  onOpenLiveActivity,
}) => {
  const {
    activePrayer,
    nextPrayer,
    timeRemainingFormatted,
    timeRemainingSeconds,
    ringProgress,
    currentKerahet,
  } = schedule;

  // Screen-reader announcement, rounded to the minute so aria-live only
  // fires once a minute instead of every second like the visible digits.
  const remainingMinutes = Math.floor(timeRemainingSeconds / 60);
  const srCountdownText =
    remainingMinutes > 0
      ? `${nextPrayer.label} vaktine yaklaşık ${remainingMinutes} dakika kaldı.`
      : `${nextPrayer.label} vaktine bir dakikadan az kaldı.`;

  // Circle SVG dimensions
  const size = 260; // Responsive width/height
  const strokeWidth = 2.5; // Thin 2px-3px gold line as specified
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - ringProgress);

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-6 px-4 max-w-md mx-auto w-full text-center">
      {/* Kerahet Uyarısı (Eğer şu an kerahet vaktiyse) */}
      {currentKerahet && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full mb-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300"
        >
          <WarningIcon className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            <strong className="font-semibold">{currentKerahet.title}:</strong> {currentKerahet.description}
          </span>
        </motion.div>
      )}

      {/* Merkezi Zaman Halkası (Ekranın kalbi) */}
      <div className="relative my-auto flex flex-col items-center justify-center animate-blur-up">
        {/* Glow effect behind golden ring */}
        <div className="absolute w-[240px] h-[240px] rounded-full bg-gold/5 blur-2xl pointer-events-none" />

        <div className="relative w-[260px] h-[260px] flex items-center justify-center">
          <svg
            width={size}
            height={size}
            className="transform -rotate-90 drop-shadow-sm"
          >
            {/* Arka plan pasif halka */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="var(--mist)"
              strokeOpacity={0.25}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Ön plan ilerleyen altın halka */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="var(--gold)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          {/* Sayacın İçi */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
            <div aria-hidden="true">
              {/* Üst Bilgi Etiketi */}
              <span className="text-xs font-medium text-mist tracking-wide uppercase mb-1 block text-center">
                {nextPrayer.label}’ye kalan süre
              </span>

              {/* Geri Sayım Rakamları */}
              <div
                className="font-numbers font-extrabold tracking-tight text-ink my-1"
                style={{ fontSize: 'clamp(1.75rem, 8vw, 2.5rem)' }}
              >
                {timeRemainingFormatted}
              </div>
            </div>
            <span className="sr-only" aria-live="polite">{srCountdownText}</span>

            {/* Alt Bilgi Etiketi */}
            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-gold">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              <span>{activePrayer.label} vaktindesiniz</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alt Alan: Bento Grid (Sıradaki Vakit + Kısayollar) */}
      <div className="w-full grid grid-cols-2 gap-3 mt-4">
        {/* Sıradaki Vakit Kartı (geniş) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="col-span-2 p-3.5 rounded-2xl glass-panel border border-hairline shadow-sm flex items-center justify-between px-5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gold/10 text-gold flex items-center justify-center">
              <ClockIcon className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-[11px] text-mist uppercase tracking-wider font-semibold">
                Sıradaki Vakit
              </div>
              <div className="text-sm font-bold text-ink font-serif-title">
                {nextPrayer.label}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="font-numbers text-lg font-bold text-gold">
              {nextPrayer.timeString}
            </div>
          </div>
        </motion.div>

        {/* Kilit Ekranı Görünümü Kısayolu */}
        <motion.button
          onClick={onOpenLiveActivity}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="p-3.5 rounded-2xl bg-card/70 border border-hairline/50 flex flex-col items-start gap-2 text-left cursor-pointer transition-colors hover:border-gold/40"
          title="Kilit Ekranı / Canlı Etkinlik Widget'ını Gör"
        >
          <div className="w-8 h-8 rounded-full bg-gold/10 text-gold flex items-center justify-center">
            <DeviceMobileIcon className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-ink leading-tight">
            Kilit Ekranı Görünümü
          </span>
        </motion.button>

        {/* Tüm Vakitler Kısayolu */}
        <motion.button
          onClick={onScrollToFlow}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="p-3.5 rounded-2xl bg-card/70 border border-hairline/50 flex flex-col items-start gap-2 text-left cursor-pointer transition-colors hover:border-gold/40"
        >
          <div className="w-8 h-8 rounded-full bg-gold/10 text-gold flex items-center justify-center">
            <CalendarDotsIcon className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-ink leading-tight">
            Tüm Vakitler
          </span>
        </motion.button>
      </div>
    </div>
  );
};
