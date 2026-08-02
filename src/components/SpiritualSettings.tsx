import React, { useState } from 'react';
import {
  BellIcon,
  ClockIcon,
  MoonIcon,
  CalendarDotsIcon,
  CaretDownIcon,
  CheckIcon,
  GearIcon,
  PlayIcon,
  DeviceMobileIcon,
} from './icons';
import { FadeIn } from './FadeIn';
import { BottomSheet } from './BottomSheet';
import { SegmentedControl } from './SegmentedControl';
import { SupportSection } from './SupportSection';
import { AppSettings, PrayerName, SoundMode } from '../types';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { playSoundForMode } from '../utils/audio';
import type { PushStatus } from '../utils/pushClient';

interface SpiritualSettingsProps {
  settings: AppSettings;
  schedule: DayPrayerSchedule;
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

const SOUND_OPTIONS: { value: SoundMode; label: string }[] = [
  { value: 'ezan', label: 'Ezan' },
  { value: 'ilahi1', label: 'İlahi 1' },
  { value: 'ilahi2', label: 'İlahi 2' },
  { value: 'ilahi3', label: 'İlahi 3' },
  { value: 'tini', label: 'Tını' },
  { value: 'sessiz', label: 'Sessiz' },
];

const CALC_METHOD_OPTIONS: {
  value: AppSettings['calculationMethod'];
  label: string;
  description: string;
}[] = [
  { value: 'Diyanet', label: 'Türkiye Diyanet İşleri Başkanlığı', description: 'Türkiye için resmi hesaplama parametreleri' },
  { value: 'MWL', label: 'Müslüman Dünya Ligi (MWL)', description: 'Uluslararası yaygın kullanılan standart' },
  { value: 'Makkah', label: "Ümmü'l-Kurâ (Mekke-i Mükerreme)", description: 'Suudi Arabistan resmi yöntemi' },
  { value: 'ISNA', label: 'Kuzey Amerika İslam Cemiyeti (ISNA)', description: 'Kuzey Amerika için yaygın standart' },
  { value: 'Egypt', label: 'Mısır Genel Ölçüm Heyeti', description: 'Mısır ve çevresi için yaygın yöntem' },
  { value: 'Karachi', label: 'Karaçi İslam İlimleri Üniversitesi', description: 'Güney Asya için yaygın yöntem' },
];

function isIOSStandaloneNoticeNeeded(): boolean {
  if (typeof navigator === 'undefined') return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIOS && !isStandalone;
}

export const SpiritualSettings: React.FC<SpiritualSettingsProps> = ({
  settings,
  schedule,
  onUpdateSettings,
  onUpdateNotification,
  pushStatus,
  pushError,
  onEnablePush,
}) => {
  const { notifications, themeMode, calculationMethod } = settings;
  const [openSoundSheet, setOpenSoundSheet] = useState<PrayerName | null>(null);
  const [isMethodSheetOpen, setIsMethodSheetOpen] = useState(false);

  const aksamTime = schedule.prayers.find((p) => p.name === 'aksam')?.timeString ?? '--:--';
  const showIOSNotice = isIOSStandaloneNoticeNeeded();

  return (
    <div className="w-full max-w-[var(--shell-w)] mx-auto px-4 py-6 space-y-6">
      <h1 className="sr-only">Ayarlar</h1>
      {/* Başlık */}
      <div>
        <h2 className="font-serif-title text-display-l font-bold text-ink">
          Manevi Ayarlar & Bildirimler
        </h2>
        <p className="text-xs text-mist mt-1">
          Ruhunuzu ve huzurunuzu yormayan kişiselleştirmeler
        </p>
      </div>

      {/* BİLDİRİMLER */}
      <div className="space-y-3">
        <div className="text-label font-bold text-mist px-1">Bildirimler</div>

        <FadeIn delay={0} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <BellIcon className="w-4 h-4 text-gold-ink" />
            <div>
              <div className="text-sm font-bold text-ink">
                Bildirimleri Etkinleştir
              </div>
              <div className="text-[11px] text-mist">
                Vakit girdiğinde tarayıcı bildirimi alabilmek için izin verin
              </div>
            </div>
          </div>

          {pushStatus === 'granted' ? (
            <div className="flex items-center gap-2 text-xs text-success-ink font-semibold">
              <CheckIcon className="w-4 h-4" /> Bildirimler etkin
            </div>
          ) : (
            <button
              onClick={onEnablePush}
              disabled={pushStatus === 'loading'}
              className="relative w-full py-2.5 px-4 rounded-full bg-gold hover:bg-gold-hover text-on-gold font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all duration-200 cursor-pointer disabled:opacity-60 hover:scale-[1.02] active:scale-95 before:content-[''] before:absolute before:-top-2 before:-bottom-2 before:inset-x-0"
            >
              {pushStatus === 'loading' ? 'Bekleniyor...' : 'Bildirimlere İzin Ver'}
            </button>
          )}

          {pushStatus === 'denied' && (
            <p className="text-[11px] text-danger-ink">
              Bildirim izni reddedildi. Tarayıcı ayarlarından bu site için bildirimlere izin verip tekrar deneyin.
            </p>
          )}
          {pushStatus === 'error' && pushError && (
            <p className="text-[11px] text-danger-ink">{pushError}</p>
          )}

          {showIOSNotice && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-gold/10 text-[11px] text-mist">
              <DeviceMobileIcon className="w-4 h-4 text-gold-ink shrink-0 mt-0.5" />
              <span>
                iPhone'da bildirim alabilmek için Safari'de Paylaş → Ana Ekrana Ekle ile uygulamayı yükleyin.
              </span>
            </div>
          )}
        </FadeIn>

        <FadeIn delay={0.06} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gold/15 pb-2.5">
            <div className="flex items-center gap-2">
              <BellIcon className="w-4 h-4 text-gold-ink" />
              <span className="text-sm font-bold text-ink">
                Vakit Bazlı Bildirim Sesleri
              </span>
            </div>
          </div>

          <div className="space-y-1">
            {(Object.keys(PRAYER_LABELS) as PrayerName[]).map((prayer) => {
              const currentMode = notifications[prayer];
              const currentLabel = SOUND_OPTIONS.find((o) => o.value === currentMode)?.label ?? currentMode;

              return (
                <button
                  key={prayer}
                  onClick={() => setOpenSoundSheet(prayer)}
                  className="w-full flex items-center justify-between py-3 border-b border-hairline last:border-0 cursor-pointer"
                >
                  <span className="text-sm font-medium text-ink">{PRAYER_LABELS[prayer]}</span>
                  <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-paper text-ink">
                    {currentLabel}
                    <CaretDownIcon className="w-3 h-3 text-mist" />
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-mist pt-1">
            {/* Düz metin atıf — bir bağlantı olarak 44px dokunma hedefine
                büyütmek (134x12 bir kutu için) görsel olarak orantısız
                olurdu; kaynağın kendisi kritik bir eylem değil (design-
                refresh-v3 Faz 3 F5). */}
            Ezan sesi: Wikimedia Commons, Atcovi (CC BY-SA 4.0)
          </p>
        </FadeIn>

        <FadeIn delay={0.12} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-gold-ink" />
            <div>
              <div className="text-sm font-bold text-ink">
                Abdest & Hazırlık Hatırlatıcı
              </div>
              <div className="text-[11px] text-mist">
                Vaktin girmesinden önce huzurlu bir hazırlık uyarısı gönderir
              </div>
            </div>
          </div>

          <SegmentedControl
            layoutId="early-warning-segment"
            value={String(notifications.earlyWarningMinutes)}
            onChange={(val) =>
              onUpdateSettings({
                notifications: { ...notifications, earlyWarningMinutes: Number(val) },
              })
            }
            options={[0, 15, 30, 45, 60].map((mins) => ({
              value: String(mins),
              label: mins === 0 ? 'Kapalı' : `${mins} dk`,
            }))}
          />
        </FadeIn>
      </div>

      {/* GÖRÜNÜM */}
      <div className="space-y-3">
        <div className="text-label font-bold text-mist px-1">Görünüm</div>

        <FadeIn delay={0.18} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <MoonIcon className="w-4 h-4 text-gold-ink" />
            <div>
              <div className="text-sm font-bold text-ink">
                Gece Teması & Otomatik Dönüşüm
              </div>
              <div className="text-[11px] text-mist">
                Gün batımında krem zeminden koyu laciverte geçer
              </div>
            </div>
          </div>

          <SegmentedControl
            layoutId="theme-mode-segment"
            value={themeMode}
            onChange={(val) => onUpdateSettings({ themeMode: val as AppSettings['themeMode'] })}
            options={[
              { value: 'auto', label: 'Otomatik' },
              { value: 'light', label: 'Açık' },
              { value: 'dark', label: 'Koyu' },
            ]}
          />

          {themeMode === 'auto' && (
            <p className="text-[11px] text-mist">
              Bugün akşam vaktinde (<span className="font-semibold text-gold-ink">{aksamTime}</span>) koyu temaya geçecek.
            </p>
          )}
        </FadeIn>
      </div>

      {/* HESAPLAMA */}
      <div className="space-y-3">
        <div className="text-label font-bold text-mist px-1">Hesaplama</div>

        <FadeIn delay={0.24} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <GearIcon className="w-4 h-4 text-gold-ink" />
            <div>
              <div className="text-sm font-bold text-ink">
                Hesaplama Yöntemi
              </div>
              <div className="text-[11px] text-mist">
                Diyanet İşleri Başkanlığı ve uluslararası astronomik yöntemler
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsMethodSheetOpen(true)}
            className="relative w-full flex items-center justify-between p-2.5 rounded-xl bg-paper text-left cursor-pointer before:content-[''] before:absolute before:-top-1.5 before:-bottom-1.5 before:inset-x-0"
          >
            <span className="text-xs font-semibold text-ink">
              {CALC_METHOD_OPTIONS.find((o) => o.value === calculationMethod)?.label}
            </span>
            <CaretDownIcon className="w-3.5 h-3.5 text-mist shrink-0" />
          </button>
        </FadeIn>
      </div>

      {/* HAKKINDA */}
      <div className="space-y-3">
        <div className="text-label font-bold text-mist px-1">Hakkında</div>

        <SupportSection />

        <FadeIn delay={0.36} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-2">
          <div className="flex items-center gap-2">
            <CalendarDotsIcon className="w-4 h-4 text-gold-ink" />
            <div className="text-sm font-bold text-ink">
              Hicri Tarih Hakkında
            </div>
          </div>
          <p className="text-[11px] text-mist leading-relaxed">
            Uygulamadaki hicri tarih, Ümmü'l-Kura takvim verisine dayanan astronomik bir hesaplamadır. Diyanet İşleri Başkanlığı'nın resmi açıklamasından bazı aylarda ±1 gün farklı olabilir; kesin tarih için resmi Diyanet duyurularını esas alınız.
          </p>
        </FadeIn>
      </div>

      {/* Ses Seçici Sheet */}
      <BottomSheet
        isOpen={openSoundSheet !== null}
        onClose={() => setOpenSoundSheet(null)}
        title={openSoundSheet ? `${PRAYER_LABELS[openSoundSheet]} Bildirim Sesi` : ''}
      >
        <div className="space-y-1 pb-2">
          {SOUND_OPTIONS.map((opt) => {
            const isSelected = openSoundSheet !== null && notifications[openSoundSheet] === opt.value;
            return (
              <div
                key={opt.value}
                className={`flex items-stretch justify-between p-3.5 rounded-xl ${
                  isSelected ? 'bg-gold/10' : ''
                }`}
              >
                <button
                  onClick={() => {
                    if (openSoundSheet === null) return;
                    onUpdateNotification(openSoundSheet, opt.value);
                    playSoundForMode(opt.value);
                  }}
                  className="flex-1 flex items-center gap-2 text-left cursor-pointer"
                >
                  {isSelected && <CheckIcon className="w-4 h-4 text-gold-ink shrink-0" />}
                  <span className={`text-sm font-medium ${isSelected ? 'text-gold-ink' : 'text-ink'}`}>
                    {opt.label}
                  </span>
                </button>
                <button
                  onClick={() => playSoundForMode(opt.value)}
                  aria-label={`${opt.label} sesini önizle`}
                  className="p-3.5 rounded-full hover:bg-gold/10 text-gold-ink cursor-pointer shrink-0"
                >
                  <PlayIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </BottomSheet>

      {/* Hesaplama Yöntemi Sheet */}
      <BottomSheet
        isOpen={isMethodSheetOpen}
        onClose={() => setIsMethodSheetOpen(false)}
        title="Hesaplama Yöntemi"
      >
        <div className="space-y-1 pb-2">
          {CALC_METHOD_OPTIONS.map((opt) => {
            const isSelected = calculationMethod === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  onUpdateSettings({ calculationMethod: opt.value });
                  setIsMethodSheetOpen(false);
                }}
                className={`w-full flex items-start gap-2 p-3 rounded-xl text-left cursor-pointer ${
                  isSelected ? 'bg-gold/10' : ''
                }`}
              >
                {isSelected ? (
                  <CheckIcon className="w-4 h-4 text-gold-ink shrink-0 mt-0.5" />
                ) : (
                  <span className="w-4 h-4 shrink-0" />
                )}
                <div>
                  <div className={`text-sm font-semibold ${isSelected ? 'text-gold-ink' : 'text-ink'}`}>
                    {opt.label}
                  </div>
                  <div className="text-[11px] text-mist mt-0.5">{opt.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
};
