import React from 'react';
import { motion } from 'motion/react';
import {
  Bell,
  Volume2,
  VolumeX,
  Clock,
  Moon,
  ShieldCheck,
  Check,
  Play,
  Settings2,
  CalendarDays,
} from 'lucide-react';
import { AppSettings, PrayerName, SoundMode } from '../types';
import { playSoftChime, playEzanSample } from '../utils/audio';
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
        <h2 className="text-xl font-serif-title font-bold text-[var(--ink)]">
          Manevi Ayarlar & Bildirimler
        </h2>
        <p className="text-xs text-[var(--mist)] mt-1">
          Ruhunuzu ve huzurunuzu yormayan kişiselleştirmeler
        </p>
      </div>

      {/* 0. Bildirimleri Etkinleştir */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#D6A84D]" />
          <div>
            <div className="text-sm font-bold text-[var(--ink)] font-serif-title">
              Bildirimleri Etkinleştir
            </div>
            <div className="text-[11px] text-[var(--mist)]">
              Vakit girdiğinde tarayıcı bildirimi alabilmek için izin verin
            </div>
          </div>
        </div>

        {pushStatus === 'granted' ? (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <Check className="w-4 h-4" /> Bildirimler etkin
          </div>
        ) : (
          <button
            onClick={onEnablePush}
            disabled={pushStatus === 'loading'}
            className="w-full py-2.5 px-4 rounded-xl bg-[#D6A84D] hover:bg-[#c4983e] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
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
      </div>

      {/* 1. Vakit Bazlı Bildirim Seçimi */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#D6A84D]/15 pb-2.5">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#D6A84D]" />
            <span className="text-sm font-bold text-[var(--ink)] font-serif-title">
              Vakit Bazlı Bildirim Sesleri
            </span>
          </div>
          <span className="text-[10px] text-[#D6A84D] font-medium bg-[#D6A84D]/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm font-medium text-[var(--ink)]">
                  {PRAYER_LABELS[prayer]}
                </span>

                <div className="flex items-center gap-1 bg-[var(--paper)] p-1 rounded-xl border border-[#D6A84D]/15">
                  <button
                    onClick={() => {
                      onUpdateNotification(prayer, 'ezan');
                      playEzanSample();
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                      currentMode === 'ezan'
                        ? 'bg-[#D6A84D] text-white shadow-xs'
                        : 'text-[var(--mist)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <Bell className="w-3 h-3" /> Ezan
                  </button>

                  <button
                    onClick={() => {
                      onUpdateNotification(prayer, 'tini');
                      playSoftChime();
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                      currentMode === 'tini'
                        ? 'bg-[#D6A84D] text-white shadow-xs'
                        : 'text-[var(--mist)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <Volume2 className="w-3 h-3" /> Tını
                  </button>

                  <button
                    onClick={() => onUpdateNotification(prayer, 'sessiz')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                      currentMode === 'sessiz'
                        ? 'bg-[#D6A84D] text-white shadow-xs'
                        : 'text-[var(--mist)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <VolumeX className="w-3 h-3" /> Sessiz
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Erken Uyarı (Abdest Hatırlatıcı) */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#D6A84D]" />
          <div>
            <div className="text-sm font-bold text-[var(--ink)] font-serif-title">
              Abdest & Hazırlık Hatırlatıcı
            </div>
            <div className="text-[11px] text-[var(--mist)]">
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
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                notifications.earlyWarningMinutes === mins
                  ? 'bg-[#D6A84D] text-white border-[#D6A84D] shadow-xs'
                  : 'bg-[var(--paper)] text-[var(--ink)] border-transparent hover:border-[#D6A84D]/30'
              }`}
            >
              {mins === 0 ? 'Kapalı' : `${mins} dk`}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Gece Modu ve Otomatik Zemin Değişimi */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-[#D6A84D]" />
            <div>
              <div className="text-sm font-bold text-[var(--ink)] font-serif-title">
                Gece Teması & Otomatik Dönüşüm
              </div>
              <div className="text-[11px] text-[var(--mist)]">
                Gün batımında krem zeminden koyu laciverte (#1A1B1E) geçer
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
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                themeMode === mode.id
                  ? 'bg-[#D6A84D] text-white border-[#D6A84D]'
                  : 'bg-[var(--paper)] text-[var(--ink)] border-transparent hover:border-[#D6A84D]/30'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Hesaplama Yöntemi */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-[#D6A84D]" />
          <div>
            <div className="text-sm font-bold text-[var(--ink)] font-serif-title">
              Hesaplama Yöntemi
            </div>
            <div className="text-[11px] text-[var(--mist)]">
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
          className="w-full p-2.5 rounded-xl bg-[var(--paper)] border border-[#D6A84D]/20 text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[#D6A84D]"
        >
          <option value="Diyanet">Türkiye Diyanet İşleri Başkanlığı</option>
          <option value="MWL">Müslüman Dünya Ligi (MWL)</option>
          <option value="Makkah">Ümmü'l-Kurâ (Mekke-i Mükerreme)</option>
          <option value="ISNA">Kuzey Amerika İslam Cemiyeti (ISNA)</option>
          <option value="Egypt">Mısır Genel Ölçüm Heyeti</option>
          <option value="Karachi">Karaçi İslam İlimleri Üniversitesi</option>
        </select>
      </div>

      {/* 4.5 Hicri Tarih Hakkında */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[#D6A84D]" />
          <div className="text-sm font-bold text-[var(--ink)] font-serif-title">
            Hicri Tarih Hakkında
          </div>
        </div>
        <p className="text-[11px] text-[var(--mist)] leading-relaxed">
          Uygulamadaki hicri tarih, Ümmü'l-Kura takvim verisine dayanan astronomik bir hesaplamadır. Diyanet İşleri Başkanlığı'nın resmi açıklamasından bazı aylarda ±1 gün farklı olabilir; kesin tarih için resmi Diyanet duyurularını esas alınız.
        </p>
      </div>

      {/* 5. İnternetsiz Çevrimdışı Bellek (30 Günlük Local DB) */}
      <div className="p-4 rounded-2xl bg-[#D6A84D]/10 border border-[#D6A84D]/30 flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-[#D6A84D] shrink-0" />
        <div>
          <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
            <span>30 Günlük Çevrimdışı Vakit Paketi Yüklü</span>
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-[11px] text-[var(--mist)] leading-relaxed mt-0.5">
            İnternet bağlantınız kesilse dahi tüm vakitler ve bildirimler telefonunuzun yerel hafızasından sorunsuz çalışır.
          </p>
        </div>
      </div>
    </div>
  );
};
