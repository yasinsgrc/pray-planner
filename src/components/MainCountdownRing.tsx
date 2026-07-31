import React from 'react';
import { motion } from 'motion/react';
import { Clock, AlertTriangle, Smartphone, ChevronDown } from 'lucide-react';
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
    ringProgress,
    currentKerahet,
  } = schedule;

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
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            <strong className="font-semibold">{currentKerahet.title}:</strong> {currentKerahet.description}
          </span>
        </motion.div>
      )}

      {/* Merkezi Zaman Halkası (Ekranın kalbi) */}
      <div className="relative my-auto flex flex-col items-center justify-center">
        {/* Glow effect behind golden ring */}
        <div className="absolute w-[240px] h-[240px] rounded-full bg-[#D6A84D]/5 blur-2xl pointer-events-none" />

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
              stroke="#D6A84D"
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
            {/* Üst Bilgi Etiketi */}
            <span className="text-xs font-medium text-[var(--mist)] tracking-wide uppercase mb-1">
              {nextPrayer.label}’ye kalan süre
            </span>

            {/* Geri Sayım Rakamları */}
            <div className="font-numbers text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--ink)] my-1">
              {timeRemainingFormatted}
            </div>

            {/* Alt Bilgi Etiketi */}
            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#D6A84D]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D6A84D] animate-pulse" />
              <span>{activePrayer.label} vaktindesiniz</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alt Alan: Sıradaki Vakit Kartı ve Detay Butonu */}
      <div className="w-full space-y-3 mt-4">
        {/* Sıradaki Vakit Kartı */}
        <motion.div
          whileHover={{ y: -2 }}
          className="w-full p-3.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm flex items-center justify-between px-5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#D6A84D]/10 text-[#D6A84D] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-[11px] text-[var(--mist)] uppercase tracking-wider font-semibold">
                Sıradaki Vakit
              </div>
              <div className="text-sm font-bold text-[var(--ink)] font-serif-title">
                {nextPrayer.label}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="font-numbers text-lg font-bold text-[#D6A84D]">
              {nextPrayer.timeString}
            </div>
          </div>
        </motion.div>

        {/* Canlı Etkinlik / Kilit Ekranı Widget Önizleme Butonu */}
        <div className="flex items-center justify-between text-xs text-[var(--mist)] px-1">
          <button
            onClick={onOpenLiveActivity}
            className="flex items-center gap-1.5 hover:text-[#D6A84D] transition-colors cursor-pointer py-1"
            title="Kilit Ekranı / Canlı Etkinlik Widget'ını Gör"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#D6A84D]" />
            <span>Kilit Ekranı Görünümü</span>
          </button>

          <button
            onClick={onScrollToFlow}
            className="flex items-center gap-1 hover:text-[#D6A84D] transition-colors cursor-pointer py-1"
          >
            <span>Tüm Vakitler</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
