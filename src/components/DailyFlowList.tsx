import React from 'react';
import { motion } from 'motion/react';
import {
  MoonStarsIcon,
  SunIcon,
  CloudSunIcon,
  SunDimIcon,
  SunHorizonIcon,
  SparkleIcon,
  WarningCircleIcon,
  SpeakerHighIcon,
  SpeakerXIcon,
  BellIcon,
} from '@phosphor-icons/react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { PrayerName, SoundMode } from '../types';

interface DailyFlowListProps {
  schedule: DayPrayerSchedule;
  notifications: Record<PrayerName, SoundMode>;
  onOpenSettings: () => void;
}

const PRAYER_ICONS: Record<PrayerName, React.ReactNode> = {
  imsak: <MoonStarsIcon className="w-5 h-5" />,
  gunes: <SunHorizonIcon className="w-5 h-5" />,
  ogle: <SunIcon className="w-5 h-5" />,
  ikindi: <SunDimIcon className="w-5 h-5" />,
  aksam: <CloudSunIcon className="w-5 h-5" />,
  yatsi: <SparkleIcon className="w-5 h-5" />,
};

export const DailyFlowList: React.FC<DailyFlowListProps> = ({
  schedule,
  notifications,
  onOpenSettings,
}) => {
  const { prayers, kerahetTimes } = schedule;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between border-b border-gold/15 pb-3">
        <div>
          <h2 className="text-lg font-serif-title font-bold text-ink">
            Günlük Vakit Akışı
          </h2>
          <p className="text-xs text-mist">
            Günün 6 ana zaman dilimi ve kerahet vakitleri
          </p>
        </div>
        <button
          onClick={onOpenSettings}
          className="text-xs font-semibold text-gold hover:underline cursor-pointer"
        >
          Ses Ayarları
        </button>
      </div>

      {/* Vakit Listesi */}
      <div className="space-y-3">
        {prayers.map((item, index) => {
          const soundMode = notifications[item.name];

          // Check if there is a kerahet window right before this prayer or right after sunrise
          const isGunes = item.name === 'gunes';
          const isOgle = item.name === 'ogle';
          const isAksam = item.name === 'aksam';

          return (
            <React.Fragment key={item.name}>
              {/* Güneş Sonrası Kerahet Çizgisi */}
              {isGunes && (
                <div className="my-1.5 p-2 rounded-lg bg-orange-500/5 border-l-2 border-orange-400/60 flex items-center gap-2 text-[11px] text-orange-700 dark:text-orange-300">
                  <WarningCircleIcon className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>
                    <strong>Kerahet Vakti:</strong> Güneş doğduktan sonra 45 dakika namaz kılınmaz.
                  </span>
                </div>
              )}

              {/* Öğle Öncesi Kerahet Çizgisi */}
              {isOgle && (
                <div className="my-1.5 p-2 rounded-lg bg-orange-500/5 border-l-2 border-orange-400/60 flex items-center gap-2 text-[11px] text-orange-700 dark:text-orange-300">
                  <WarningCircleIcon className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>
                    <strong>İstivâ Keraheti:</strong> Öğleye 45 dk kala namaz kılınmaz.
                  </span>
                </div>
              )}

              {/* Akşam Öncesi Kerahet Çizgisi */}
              {isAksam && (
                <div className="my-1.5 p-2 rounded-lg bg-orange-500/5 border-l-2 border-orange-400/60 flex items-center gap-2 text-[11px] text-orange-700 dark:text-orange-300">
                  <WarningCircleIcon className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>
                    <strong>İstifrâ Keraheti:</strong> Akşama 45 dk kala (kerahet vakti).
                  </span>
                </div>
              )}

              {/* Vakit Satırı / Kartı */}
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`relative rounded-xl p-4 transition-all flex items-center justify-between ${
                  item.isActive
                    ? 'glass-panel shadow-md border-l-4 border-l-gold border-t border-r border-b border-t-hairline border-r-hairline border-b-hairline scale-[1.02]'
                    : item.isPast
                    ? 'bg-card/40 opacity-40 grayscale-[20%]'
                    : 'bg-card/70 border border-hairline/50'
                }`}
              >
                {/* Sol: İkon ve İsim */}
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      item.isActive
                        ? 'bg-gold text-white shadow-sm'
                        : item.isPast
                        ? 'bg-gray-200 dark:bg-gray-800 text-mist'
                        : 'bg-gold/10 text-gold'
                    }`}
                  >
                    {PRAYER_ICONS[item.name]}
                  </div>

                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-serif-title font-bold text-base ${
                          item.isActive
                            ? 'text-gold'
                            : 'text-ink'
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.isActive && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gold/15 text-gold tracking-wide">
                          ŞU ANKİ VAKİT
                        </span>
                      )}
                      {item.isNext && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 tracking-wide">
                          SIRADAKİ
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-mist mt-0.5">
                      {item.isActive
                        ? 'Şu an bu vakit içerisindesiniz'
                        : item.isPast
                        ? 'Geçmiş vakit'
                        : 'Gelecek vakit'}
                    </div>
                  </div>
                </div>

                {/* Sağ: Saat ve Bildirim İkonu */}
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div
                      className={`font-numbers text-lg font-bold ${
                        item.isActive
                          ? 'text-gold'
                          : 'text-ink'
                      }`}
                    >
                      {item.timeString}
                    </div>
                    <div className="text-[10px] text-mist flex items-center justify-end gap-1">
                      {soundMode === 'ezan' && (
                        <span className="flex items-center gap-0.5 text-gold">
                          <BellIcon className="w-2.5 h-2.5" /> Ezan
                        </span>
                      )}
                      {soundMode === 'tini' && (
                        <span className="flex items-center gap-0.5 text-sand">
                          <SpeakerHighIcon className="w-2.5 h-2.5" /> Tını
                        </span>
                      )}
                      {(soundMode === 'ilahi1' || soundMode === 'ilahi2' || soundMode === 'ilahi3') && (
                        <span className="flex items-center gap-0.5 text-sand">
                          <SpeakerHighIcon className="w-2.5 h-2.5" /> İlahi {soundMode.slice(-1)}
                        </span>
                      )}
                      {soundMode === 'sessiz' && (
                        <span className="flex items-center gap-0.5 text-mist">
                          <SpeakerXIcon className="w-2.5 h-2.5" /> Sessiz
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
