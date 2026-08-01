import React from 'react';
import { motion } from 'motion/react';
import {
  SpeakerHighIcon,
  SpeakerXIcon,
  BellIcon,
} from '@phosphor-icons/react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { PRAYER_ICON_COMPONENTS } from './prayerIcons';
import { KERAHET_SHORT_LABEL, formatKerahetRange } from '../utils/kerahetLabels';
import { PrayerName, SoundMode } from '../types';

interface DailyFlowListProps {
  schedule: DayPrayerSchedule;
  notifications: Record<PrayerName, SoundMode>;
  onOpenSettings: () => void;
}

export const DailyFlowList: React.FC<DailyFlowListProps> = ({
  schedule,
  notifications,
  onOpenSettings,
}) => {
  const { prayers, kerahetTimes, tomorrowImsakTime, tomorrowAksamTime } = schedule;

  return (
    <div className="w-full max-w-[var(--shell-w)] mx-auto px-4 py-6 space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between border-b border-gold/15 pb-3">
        <div>
          <h2 className="font-serif-title text-display-l font-bold text-ink">
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

      {/* Desen efsanesi: kerahet dilini kadran/liste/kilit ekranında tek yerde açıkla */}
      <div className="space-y-0.5">
        <p className="flex items-center gap-1.5 text-micro text-mist">
          <span
            className="inline-block w-3 h-3 rounded-sm shrink-0"
            style={{ background: 'var(--pattern-kerahet)' }}
            aria-hidden="true"
          />
          taralı aralıklar kerahet vaktidir
        </p>
        <p className="text-micro text-mist pl-[18px]">
          Fıkhî ayrıntılar mezhebe göre farklılık gösterebilir.
        </p>
      </div>

      {/* Vakit Akışı: sol omurga + düğümler */}
      <div>
        {prayers.map((item, index) => {
          const soundMode = notifications[item.name];
          const nextItem = prayers[index + 1];
          const kerahetInGap = kerahetTimes.filter(
            (k) => k.startTime >= item.dateObj && (!nextItem || k.startTime < nextItem.dateObj)
          );
          const lineColor = item.isPast || item.isActive ? `var(--v-${item.name})` : 'var(--hairline)';
          const isLast = index === prayers.length - 1 && kerahetInGap.length === 0;

          return (
            <React.Fragment key={item.name}>
              {/* Vakit Satırı / Kartı */}
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-stretch gap-3"
              >
                {/* Omurga: çizgi + düğüm */}
                <div className="relative w-6 flex-shrink-0 flex flex-col items-center">
                  {!isLast && (
                    <div
                      className="absolute top-5 bottom-0 w-0.5"
                      style={{
                        backgroundColor: item.isPast ? lineColor : 'transparent',
                        borderLeft: item.isPast ? undefined : `2px dashed var(--hairline)`,
                      }}
                    />
                  )}
                  <div
                    className={`relative z-10 mt-4 w-3 h-3 rounded-full border-2 ${
                      item.isActive ? 'scale-125' : ''
                    }`}
                    style={{
                      backgroundColor: item.isPast || item.isActive ? lineColor : 'var(--paper)',
                      borderColor: lineColor,
                    }}
                  />
                </div>

                <div
                  className={`flex-1 my-1.5 rounded-xl p-4 transition-all flex items-center justify-between ${
                    item.isActive
                      ? 'glass-panel shadow-md border-t border-r border-b border-t-hairline border-r-hairline border-b-hairline'
                      : 'bg-card/70 border border-hairline/50'
                  }`}
                  style={item.isActive ? { borderLeft: `3px solid var(--v-${item.name})` } : undefined}
                >
                  {/* Sol: İkon ve İsim */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        item.isActive ? 'text-white shadow-sm' : 'bg-gold/10 text-gold'
                      }`}
                      style={item.isActive ? { backgroundColor: `var(--v-${item.name})` } : undefined}
                    >
                      {React.createElement(PRAYER_ICON_COMPONENTS[item.name], { className: 'w-5 h-5' })}
                    </div>

                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold text-base ${
                            item.isActive ? 'text-gold' : item.isPast ? 'text-mist' : 'text-ink'
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
                      <div className="text-micro text-mist mt-0.5">
                        {item.isActive
                          ? 'Şu an bu vakit içerisindesiniz'
                          : item.isPast
                          ? 'Geçmiş vakit'
                          : 'Gelecek vakit'}
                      </div>
                    </div>
                  </div>

                  {/* Sağ: Saat ve Bildirim Butonu */}
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <div className={`font-numbers text-lg font-bold ${item.isActive ? 'text-gold' : 'text-ink'}`}>
                        {item.timeString}
                      </div>
                      <button
                        onClick={onOpenSettings}
                        className="text-micro text-mist flex items-center justify-end gap-1 ml-auto cursor-pointer hover:text-gold transition-colors"
                        title="Ses ayarını değiştir"
                      >
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
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Kerahet segmentleri: omurganın kendisi taralı banda dönüşür, kartlardan bilinçli olarak zayıf */}
              {kerahetInGap.map((k) => (
                <div key={k.type} className="flex items-stretch gap-3 py-1">
                  <div className="relative w-6 flex-shrink-0 flex flex-col items-center">
                    <div
                      className="absolute top-0 bottom-0 w-1"
                      style={{
                        background: k.isActiveNow
                          ? `repeating-linear-gradient(45deg, var(--accent) 0 2px, transparent 2px 6px)`
                          : 'var(--pattern-kerahet)',
                      }}
                    />
                  </div>
                  <div
                    className={`flex-1 rounded-lg px-3 py-1.5 flex items-center justify-between ${
                      k.isActiveNow ? 'bg-accent/10' : 'bg-paper'
                    }`}
                  >
                    <span
                      className={`text-micro ${k.isActiveNow ? 'text-accent font-semibold' : 'text-ink font-medium'}`}
                    >
                      {KERAHET_SHORT_LABEL[k.type]}
                    </span>
                    <span className="font-numbers text-micro text-mist">{formatKerahetRange(k)}</span>
                  </div>
                </div>
              ))}
            </React.Fragment>
          );
        })}
      </div>

      {/* Yarın Özeti */}
      <div className="mt-2 p-4 rounded-2xl bg-card/70 border border-hairline/50 flex items-center justify-between">
        <div>
          <div className="text-label text-mist font-semibold">Yarın</div>
          <div className="text-sm font-bold text-ink">İmsak & Akşam</div>
        </div>
        <div className="text-right font-numbers text-sm font-bold text-ink">
          <div>{tomorrowImsakTime} <span className="text-mist font-normal">İmsak</span></div>
          <div>{tomorrowAksamTime} <span className="text-mist font-normal">Akşam</span></div>
        </div>
      </div>
    </div>
  );
};
