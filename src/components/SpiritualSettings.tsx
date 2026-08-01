import React from 'react';
import {
  BellIcon,
  ClockIcon,
  MoonIcon,
  ShieldCheckIcon,
  CheckIcon,
  GearIcon,
  CalendarDotsIcon,
} from '@phosphor-icons/react';
import { FadeIn } from './FadeIn';
import { AppSettings, PrayerName, SoundMode } from '../types';
import { playSoundForMode } from '../utils/audio';
import type { PushStatus } from '../utils/pushClient';

interface SpiritualSettingsProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onUpdateNotification: (prayer: PrayerName, mode: SoundMode) => void;
  pushStatus: PushStatus;
  pushError: string | null;
  onEnablePush: () => void;
}

const PRAYER_LABELS: Record<PrayerName, string> = {
  imsak: 'İmsak',
  gunes: 'Güneş',
  ogle: 'Öğle',
  ikindi: 'İkindi',
  aksam: 'Akşam',
  yatsi: 'Yatsı',
};

export const SpiritualSettings: React.FC<SpiritualSettingsProps> = ({
  settings,
  onUpdateSettings,
  onUpdateNotification,
  pushStatus,
  pushError,
  onEnablePush,
}) => {
  const { notifications, themeMode, calculationMethod } = settings;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6">
      {/* Başlık */}
      <div>
        <h2 className="text-xl font-serif-title font-bold text-ink">
          Manevi Ayarlar & Bildirimler
        </h2>
        <p className="text-xs text-mist mt-1">
          Ruhunuzu ve huzurunuzu yormayan kişiselleştirmeler
        </p>
      </div>

      {/* 0. Bildirimleri Etkinleştir */}
      <FadeIn delay={0} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <BellIcon className="w-4 h-4 text-gold" />
          <div>
            <div className="text-sm font-bold text-ink font-serif-title">
              Bildirimleri Etkinleştir
            </div>
            <div className="text-[11px] text-mist">
              Vakit girdiğinde tarayıcı bildirimi alabilmek için izin verin
            </div>
          </div>
        </div>

        {pushStatus === 'granted' ? (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckIcon className="w-4 h-4" /> Bildirimler etkin
          </div>
        ) : (
          <button
            onClick={onEnablePush}
            disabled={pushStatus === 'loading'}
            className="w-full py-2.5 px-4 rounded-full bg-gold hover:bg-[#c4983e] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all duration-200 cursor-pointer disabled:opacity-60 hover:scale-[1.02] active:scale-95"
          >
            {pushStatus === 'loading' ? 'Bekleniyor...' : 'Bildirimlere İzin Ver'}
          </button>
        )}

        {pushStatus === 'denied' && (
          <p className="text-[11px] text-red-500">
            Bildirim izni reddedildi. Tarayıcı ayarlarından bu site için bildirimlere izin verip tekrar deneyin.
          </p>
        )}
        {pushStatus === 'error' && pushError && (
          <p className="text-[11px] text-red-500">{pushError}</p>
        )}
      </FadeIn>

      {/* 1. Vakit Bazlı Bildirim Seçimi */}
      <FadeIn delay={0.06} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gold/15 pb-2.5">
          <div className="flex items-center gap-2">
            <BellIcon className="w-4 h-4 text-gold" />
            <span className="text-sm font-bold text-ink font-serif-title">
              Vakit Bazlı Bildirim Sesleri
            </span>
          </div>
          <span className="text-[10px] text-gold font-medium bg-gold/10 px-2 py-0.5 rounded-full">
            Özelleştirilebilir
          </span>
        </div>

        <div className="space-y-3">
          {(Object.keys(PRAYER_LABELS) as PrayerName[]).map((prayer) => {
            const currentMode = notifications[prayer];

            return (
              <div
                key={prayer}
                className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/40 last:border-0"
              >
                <span className="text-sm font-medium text-ink">
                  {PRAYER_LABELS[prayer]}
                </span>

                <select
                  value={currentMode}
                  onChange={(e) => {
                    const mode = e.target.value as SoundMode;
                    onUpdateNotification(prayer, mode);
                    playSoundForMode(mode);
                  }}
                  aria-label={`${PRAYER_LABELS[prayer]} bildirim sesi`}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-paper border border-gold/15 text-ink focus:outline-none focus:border-gold cursor-pointer"
                >
                  <option value="ezan">Ezan</option>
                  <option value="ilahi1">İlahi 1</option>
                  <option value="ilahi2">İlahi 2</option>
                  <option value="ilahi3">İlahi 3</option>
                  <option value="tini">Tını</option>
                  <option value="sessiz">Sessiz</option>
                </select>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-mist pt-1">
          Ezan sesi:{' '}
          <a
            href="https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gold"
          >
            Wikimedia Commons, Atcovi
          </a>{' '}
          (CC BY-SA 4.0)
        </p>
      </FadeIn>

      {/* 2. Erken Uyarı (Abdest Hatırlatıcı) */}
      <FadeIn delay={0.12} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-gold" />
          <div>
            <div className="text-sm font-bold text-ink font-serif-title">
              Abdest & Hazırlık Hatırlatıcı
            </div>
            <div className="text-[11px] text-mist">
              Vaktin girmesinden önce huzurlu bir hazırlık uyarısı gönderir
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5 pt-1">
          {[0, 15, 30, 45, 60].map((mins) => (
            <button
              key={mins}
              onClick={() =>
                onUpdateSettings({
                  notifications: {
                    ...notifications,
                    earlyWarningMinutes: mins,
                  },
                })
              }
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all duration-200 border cursor-pointer hover:scale-[1.03] active:scale-95 ${
                notifications.earlyWarningMinutes === mins
                  ? 'bg-gold text-white border-gold shadow-xs'
                  : 'bg-paper text-ink border-transparent hover:border-gold/30'
              }`}
            >
              {mins === 0 ? 'Kapalı' : `${mins} dk`}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* 3. Gece Modu ve Otomatik Zemin Değişimi */}
      <FadeIn delay={0.18} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MoonIcon className="w-4 h-4 text-gold" />
            <div>
              <div className="text-sm font-bold text-ink font-serif-title">
                Gece Teması & Otomatik Dönüşüm
              </div>
              <div className="text-[11px] text-mist">
                Gün batımında krem zeminden koyu laciverte geçer
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { id: 'auto', label: 'Otomatik (Gün Batımı)' },
            { id: 'light', label: 'Açık (Sakin Krem)' },
            { id: 'dark', label: 'Koyu (Gece Lacivert)' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() =>
                onUpdateSettings({ themeMode: mode.id as AppSettings['themeMode'] })
              }
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all duration-200 border text-center cursor-pointer hover:scale-[1.03] active:scale-95 ${
                themeMode === mode.id
                  ? 'bg-gold text-white border-gold'
                  : 'bg-paper text-ink border-transparent hover:border-gold/30'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* 4. Hesaplama Yöntemi */}
      <FadeIn delay={0.24} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <GearIcon className="w-4 h-4 text-gold" />
          <div>
            <div className="text-sm font-bold text-ink font-serif-title">
              Hesaplama Yöntemi
            </div>
            <div className="text-[11px] text-mist">
              Diyanet İşleri Başkanlığı ve uluslararası astronomik yöntemler
            </div>
          </div>
        </div>

        <select
          value={calculationMethod}
          onChange={(e) =>
            onUpdateSettings({
              calculationMethod: e.target.value as AppSettings['calculationMethod'],
            })
          }
          aria-label="Hesaplama yöntemi"
          className="w-full p-2.5 rounded-xl bg-paper border border-gold/20 text-xs font-semibold text-ink focus:outline-none focus:border-gold"
        >
          <option value="Diyanet">Türkiye Diyanet İşleri Başkanlığı</option>
          <option value="MWL">Müslüman Dünya Ligi (MWL)</option>
          <option value="Makkah">Ümmü'l-Kurâ (Mekke-i Mükerreme)</option>
          <option value="ISNA">Kuzey Amerika İslam Cemiyeti (ISNA)</option>
          <option value="Egypt">Mısır Genel Ölçüm Heyeti</option>
          <option value="Karachi">Karaçi İslam İlimleri Üniversitesi</option>
        </select>
      </FadeIn>

      {/* 4.5 Hicri Tarih Hakkında */}
      <FadeIn delay={0.3} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <CalendarDotsIcon className="w-4 h-4 text-gold" />
          <div className="text-sm font-bold text-ink font-serif-title">
            Hicri Tarih Hakkında
          </div>
        </div>
        <p className="text-[11px] text-mist leading-relaxed">
          Uygulamadaki hicri tarih, Ümmü'l-Kura takvim verisine dayanan astronomik bir hesaplamadır. Diyanet İşleri Başkanlığı'nın resmi açıklamasından bazı aylarda ±1 gün farklı olabilir; kesin tarih için resmi Diyanet duyurularını esas alınız.
        </p>
      </FadeIn>

      {/* 5. İnternetsiz Çevrimdışı Bellek (30 Günlük Local DB) */}
      <FadeIn delay={0.36} className="p-4 rounded-2xl bg-gold/10 border border-gold/30 flex items-center gap-3">
        <ShieldCheckIcon className="w-6 h-6 text-gold shrink-0" />
        <div>
          <div className="text-xs font-bold text-ink flex items-center gap-1.5">
            <span>30 Günlük Çevrimdışı Vakit Paketi Yüklü</span>
            <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-[11px] text-mist leading-relaxed mt-0.5">
            İnternet bağlantınız kesilse dahi tüm vakitler ve bildirimler telefonunuzun yerel hafızasından sorunsuz çalışır.
          </p>
        </div>
      </FadeIn>
    </div>
  );
};
