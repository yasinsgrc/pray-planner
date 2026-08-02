import React from 'react';
import { motion } from 'motion/react';
import { ClockIcon, DeviceMobileIcon, CalendarDotsIcon } from './icons';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { SunArcDial } from './SunArcDial';
import { DialLegend } from './DialLegend';
import { KerahetStrip } from './KerahetStrip';
import { useDialLegendVisibility } from '../hooks/useDialLegendVisibility';

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
    kerahetTimes,
  } = schedule;

  // Screen-reader announcement, rounded to the minute so aria-live only
  // fires once a minute instead of every second like the visible digits.
  const remainingMinutes = Math.floor(timeRemainingSeconds / 60);
  const srCountdownText =
    remainingMinutes > 0
      ? `${nextPrayer.label} vaktine yaklaşık ${remainingMinutes} dakika kaldı.`
      : `${nextPrayer.label} vaktine bir dakikadan az kaldı.`;

  const showDialLegend = useDialLegendVisibility();

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-6 max-w-[var(--shell-w)] mx-auto w-full text-center">
      <h1 className="sr-only">Ana Ekran</h1>
      {/* Gün Kavisi Kadranı: ekranın büyük bölümünü kaplar, optik olarak ortalı */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full">
        <div className="relative flex flex-col items-center justify-center animate-blur-up">
          {/* Glow effect behind golden ring */}
          <div className="absolute w-[260px] h-[260px] rounded-full bg-gold/5 blur-2xl pointer-events-none" />

          <div className="relative w-[288px] h-[288px] flex items-center justify-center">
            <SunArcDial schedule={schedule} />

            {/* Sayacın İçi */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
              <div aria-hidden="true">
                {/* Üst Bilgi Etiketi */}
                <span className="text-label font-medium text-mist mb-1 block text-center">
                  {nextPrayer.label} vaktine kalan süre
                </span>

                {/* Geri Sayım Rakamları */}
                <div data-testid="countdown" className="font-numbers text-display-xl text-ink my-1">
                  {timeRemainingFormatted}
                </div>
              </div>
              <span className="sr-only" aria-live="polite">{srCountdownText}</span>

              {/* Alt Bilgi Etiketi */}
              <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-accent-ink">
                <motion.span
                  key={activePrayer.name}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="w-1.5 h-1.5 rounded-full bg-accent"
                />
                <span>{activePrayer.label} vaktindesiniz</span>
              </div>
            </div>
          </div>
        </div>

        <DialLegend schedule={schedule} />

        {/* Bir kereye mahsus mikro-efsane: kullanıcı 3 gün gördükten sonra kaybolur */}
        {showDialLegend && (
          <p className="mt-2 text-micro text-mist">
            Halka bir günü gösterir — imsaktan imsağa.
          </p>
        )}

        {/* Kerahet şeridi: kadranın altında kalıcı, layout'u kaydırmayan */}
        <KerahetStrip kerahetTimes={kerahetTimes} />
      </div>

      {/* Alt Alan: Bento Grid (Sıradaki Vakit + Kısayollar) */}
      <div className="w-full grid grid-cols-2 gap-3 mt-4 shrink-0">
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
            <div className="w-9 h-9 rounded-full bg-gold/10 text-gold-ink flex items-center justify-center">
              <ClockIcon className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-label text-mist font-semibold">
                Sıradaki Vakit
              </div>
              <div className="text-sm font-bold text-ink">
                {nextPrayer.label}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="font-numbers text-lg font-bold text-gold-ink">
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
          <div className="w-8 h-8 rounded-full bg-gold/10 text-gold-ink flex items-center justify-center">
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
          <div className="w-8 h-8 rounded-full bg-gold/10 text-gold-ink flex items-center justify-center">
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
