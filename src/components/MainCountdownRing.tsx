import React from 'react';
import { motion } from 'motion/react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { SunArcDial } from './SunArcDial';
import { DialLegend } from './DialLegend';
import { KerahetStrip } from './KerahetStrip';
import { DuaCard } from './DuaCard';
import { HomeContextSlot } from './HomeContextSlot';
import { useDialLegendVisibility } from '../hooks/useDialLegendVisibility';

interface MainCountdownRingProps {
  schedule: DayPrayerSchedule;
  now: Date;
  onOpenKerahetInfo: () => void;
  isPushHintVisible: boolean;
  onOpenPushSettings: () => void;
  onDismissPushHint: () => void;
}

export const MainCountdownRing: React.FC<MainCountdownRingProps> = ({
  schedule,
  now,
  onOpenKerahetInfo,
  isPushHintVisible,
  onOpenPushSettings,
  onDismissPushHint,
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
    <div className="flex-1 flex flex-col items-center px-4 py-2 max-w-[var(--shell-w)] mx-auto w-full text-center">
      <h1 className="sr-only">Ana Ekran</h1>
      {/* Gün Kavisi Kadranı: ekranın büyük bölümünü kaplar, optik olarak ortalı */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full">
        <div
          className="relative flex flex-col items-center justify-center animate-blur-up"
          style={
            {
              // Faz 25 Commit 3 — halka büyütüldü (kerahet yaylarının
              // okunabilmesi için), ama saf clamp(190px,60vw,240px) 360x640
              // (en kısa hedef viewport) için main.scrollHeight'i
              // clientHeight'in 55px üstüne taşırdı (gerçek dua metniyle
              // ölçüldü — npm run visual, checkFocusScreenFitsWithoutScroll).
              // 390x844/412x915 aynı formülle ZATEN 0 boşlukla tam
              // sığıyordu, yani 360'ı düzeltirken onları aynen koruyan tek
              // bir sürekli formül yok — min(vw,dvh), --ring-font-basis'in
              // kanıtlanmış deseniyle aynı, dvh'ı kısa/geniş-oranlı
              // viewport'larda (360x640) doğal olarak devreye sokuyor.
              // 24dvh, 360x640'ta ~154px verir (435px bütçeye ~7px pay
              // bırakır); 390/412'de ise vw dalı (60vw) yerine yine dvh
              // baskın çıkar ama Commit 2'nin sığan değerlerinden (211/
              // 228.75) daha küçük kalır, dolayısıyla onlar da
              // güvenle sığar. Yazı boyutları BİLEREK ayrı, dondurulmuş
              // bir referansa (--ring-font-basis: eski
              // max(160px, min(72vw, 25dvh)) formülü, Faz 25 Commit 2'den)
              // bağlı — halka büyürken metin orantılı büyürse ekranı ezer
              // (spesifikasyon: geri sayım en fazla +2px, etiketler mevcut
              // boyutta kalmalı).
              '--ring-size': 'clamp(150px, min(60vw, 24dvh), 240px)',
              '--ring-font-basis': 'max(160px, min(72vw, 25dvh))',
            } as React.CSSProperties
          }
        >
          {/* Glow effect behind golden ring — 0.875 oranı halka kabuğuyla
              aynı (Faz 24 Commit 5'ten beri: glow her zaman kabuktan biraz
              küçük kalır), artık --ring-size'a bağlı. */}
          <div className="absolute w-[calc(var(--ring-size)*0.875)] h-[calc(var(--ring-size)*0.875)] rounded-full bg-gold/5 blur-lg pointer-events-none" />

          {/* Faz 25 Commit 2 fix — halka artık tek bir --ring-size custom
              property'sinden besleniyor (kabuk + içindeki metinler), bir
              gerçek cihaz ekran görüntüsünde kabuk ~150px'e küçülüp geri
              sayım metninin ~200px genişliğiyle dışına taştığı görüldüğü
              için: eski min(48vw,16dvh) hem çok küçüktü hem de metin ondan
              bağımsız (salt vw tabanlı) büyüdüğü için ikisi anlaşamıyordu.
              72vw/25dvh, gerçek prod build'de tek tek ölçülerek seçildi:
              360x640'ta 34dvh (217.6px) bile main.scrollHeight'i
              clientHeight'in üstüne taşırıyordu (488 > 435) — flex-1
              kapsayıcının o viewport'taki gerçek payı yalnızca ~160px'e
              kadar "boş alanı doldurma" ile karşılanabiliyor, ondan
              sonrası scroll'a dönüşüyor (npm run visual'daki
              checkFocusScreenFitsWithoutScroll). 25dvh, 360x640'ta tam o
              160px sınırına oturuyor; 160px alt sınır da bununla aynı
              değer (daha kısa/olağandışı viewport'lar için). */}
          <div data-testid="ring-shell" className="relative w-[var(--ring-size)] h-[var(--ring-size)] flex items-center justify-center">
            <SunArcDial schedule={schedule} />

            {/* Sayacın İçi */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
              <div aria-hidden="true">
                {/* Üst Bilgi Etiketi — punto --ring-font-basis'e bağlı
                    (aşağıdaki geri sayımla aynı ölçek, ama --ring-size'ın
                    kendisine değil — Faz 25 Commit 3, halka büyürken metin
                    orantılı büyümesin diye). */}
                <span
                  className="font-medium text-mist mb-1 block text-center uppercase tracking-[0.08em]"
                  style={{ fontSize: 'clamp(0.65rem, calc(var(--ring-font-basis) * 0.043), 0.8125rem)' }}
                >
                  {nextPrayer.label} vaktine kalan süre
                </span>

                {/* Geri Sayım Rakamları */}
                <div
                  data-testid="countdown"
                  className="font-numbers text-ink my-1"
                  style={{
                    // +2px sabit: spesifikasyonun izin verdiği azami büyüme
                    // (rakamlar orantılı büyümesin diye --ring-font-basis'e
                    // bağlı kaldı, ama halka büyüdüğü için biraz nefes payı).
                    fontSize: 'clamp(1.75rem, calc(var(--ring-font-basis) * 0.16 + 2px), 3.25rem)',
                    letterSpacing: '-0.02em',
                    fontWeight: 800,
                  }}
                >
                  {timeRemainingFormatted}
                </div>
              </div>
              <span className="sr-only" aria-live="polite">{srCountdownText}</span>

              {/* Alt Bilgi Etiketi — aynı ölçeğe bağlı */}
              <div className="mt-1 flex items-center gap-1.5 font-medium text-accent-ink">
                <motion.span
                  key={activePrayer.name}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="w-1.5 h-1.5 rounded-full bg-accent"
                />
                <span style={{ fontSize: 'clamp(0.65rem, calc(var(--ring-font-basis) * 0.043), 0.8125rem)' }}>
                  {activePrayer.label} vaktindesiniz
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialLegend schedule={schedule} />

        {/* Bir kereye mahsus mikro-efsane: kullanıcı 3 gün gördükten sonra kaybolur */}
        {showDialLegend && (
          <p className="mt-1 text-micro text-mist">
            Halka bir günü gösterir — imsaktan imsağa.
          </p>
        )}

        {/* Kerahet şeridi: kadranın altında kalıcı, layout'u kaydırmayan */}
        <KerahetStrip kerahetTimes={kerahetTimes} timeZone={schedule.resolvedTimeZone} onOpenInfo={onOpenKerahetInfo} />
      </div>

      {/* Sabit dua kartı: eski imsak ilerleme çubuğunun (04:25→06:03,
          "1 sa 38 dk sürüyor") yerinde — düşük değerliydi ve çemberi
          büyütmek için gereken dikey alanı tüketiyordu (Faz 25 Commit 2). */}
      <DuaCard />

      {/* Bağlamsal tek slot: kerahet/dinî gün/yarınki imsak farkı/bildirim
          ipucu — fallback zincirinin hiçbiri eşleşmezse hiç yer kaplamaz. */}
      <HomeContextSlot
        schedule={schedule}
        now={now}
        onOpenKerahetInfo={onOpenKerahetInfo}
        isPushHintVisible={isPushHintVisible}
        onOpenPushSettings={onOpenPushSettings}
        onDismissPushHint={onDismissPushHint}
      />
    </div>
  );
};
