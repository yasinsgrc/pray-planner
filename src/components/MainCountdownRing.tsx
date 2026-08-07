import React from 'react';
import { motion } from 'motion/react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { SunArcDial } from './SunArcDial';
import { DialLegend } from './DialLegend';
import { KerahetStrip } from './KerahetStrip';
import { PrayerWindowBar } from './PrayerWindowBar';
import { useDialLegendVisibility } from '../hooks/useDialLegendVisibility';

interface MainCountdownRingProps {
  schedule: DayPrayerSchedule;
  now: Date;
  onOpenKerahetInfo: () => void;
}

export const MainCountdownRing: React.FC<MainCountdownRingProps> = ({
  schedule,
  now,
  onOpenKerahetInfo,
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
          <div className="absolute w-[min(300px,71vw)] h-[min(300px,71vw)] rounded-full bg-gold/5 blur-2xl pointer-events-none" />

          <div className="relative w-[min(340px,78vw)] h-[min(340px,78vw)] flex items-center justify-center">
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
        <KerahetStrip kerahetTimes={kerahetTimes} timeZone={schedule.resolvedTimeZone} onOpenInfo={onOpenKerahetInfo} />
      </div>

      {/* Vakit penceresi göstergesi: "bu namazı kılmak için ne kadar vaktim
          kaldı" — kadranın cevapladığı "bir sonraki vakte ne kadar var"
          sorusundan farklı bir soru. Eski bento grid'in yerinde. */}
      <PrayerWindowBar schedule={schedule} now={now} />
    </div>
  );
};
