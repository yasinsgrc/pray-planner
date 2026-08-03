import React, { useMemo } from 'react';
import { MapPinIcon, MoonIcon, SunIcon, CompassIcon, HandHeartIcon } from './icons';
import { LocationItem, HijriDateInfo } from '../types';

interface HeaderProps {
  location: LocationItem;
  hijriDate: HijriDateInfo;
  date: Date;
  /** Selected location's resolved IANA zone — the date strip must read in this zone, not the device's (design-refresh-v3 Faz 4 F3). */
  timeZone: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenLocationModal: () => void;
  onOpenQiblaModal: () => void;
  onOpenZikirmatikModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  location,
  hijriDate,
  date,
  timeZone,
  isDarkMode,
  onToggleDarkMode,
  onOpenLocationModal,
  onOpenQiblaModal,
  onOpenZikirmatikModal,
}) => {
  const gregorianFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long',
        timeZone,
      }),
    [timeZone]
  );

  // Yalnızca seçili konum cihazınkinden farklı bir saat diliminde olduğunda
  // görünür — kullanıcıyı "neden bu saat farklı" sorusuna karşı bilgilendirir.
  const isDifferentTimeZone = useMemo(() => {
    try {
      return timeZone !== Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return false;
    }
  }, [timeZone]);
  return (
    <header className="w-full transition-colors">
      <div className="px-5 py-4 flex items-center justify-between">
        {/* Sol: Konum */}
        <button
          onClick={onOpenLocationModal}
          className="relative flex items-center gap-2 group text-left cursor-pointer transition-all hover:opacity-80 before:content-[''] before:absolute before:-top-2.5 before:-bottom-2.5 before:inset-x-0"
          aria-label="Konumu Değiştir"
        >
          <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-gold-ink group-hover:bg-gold/20 transition-colors">
            <MapPinIcon className="w-4 h-4" />
          </div>
          {/* GPS'ten gelen bir konum, kullanıcının hiç onaylamadığı bir
              ilçe adını kesin olgu gibi sunmamalı — GPS koordinatı kesin
              ama ona iliştirilen isim en-yakın-merkez tahmini (design-refresh-v3
              Faz 14: Darıca'da GPS "Çayırova" bulmuştu, komşu ve merkezi
              çok yakın bir ilçe). Listeden elle seçilen bir konum içinse
              kullanıcı zaten o ismi onayladığı için ana başlık olarak kalır. */}
          {location.isGpsDerived ? (
            <div>
              <div className="text-xs font-semibold tracking-wide text-ink">
                Mevcut Konum
              </div>
              <div className="text-label text-mist font-medium">
                {location.lat.toFixed(2)}, {location.lng.toFixed(2)} · en yakın merkez: {location.districtName || location.cityName}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs font-semibold tracking-wide text-ink flex items-center gap-1">
                <span>{location.districtName}</span>
                <span className="text-gold-ink">•</span>
                <span className="opacity-80">{location.cityName}</span>
              </div>
              <div className="text-label text-mist font-medium">
                {location.country}
              </div>
            </div>
          )}
        </button>

        {/* Sağ: İkonlar */}
        <div className="flex items-center gap-1">
          {/* Kıble Butonu */}
          <button
            onClick={onOpenQiblaModal}
            className="p-3.5 rounded-full hover:bg-gold/10 text-ink transition-colors cursor-pointer"
            aria-label="Kıble Pusulası"
          >
            <CompassIcon className="w-4 h-4 text-gold-ink" />
          </button>

          {/* Zikirmatik Butonu */}
          <button
            onClick={onOpenZikirmatikModal}
            className="p-3.5 rounded-full hover:bg-gold/10 text-ink transition-colors cursor-pointer"
            aria-label="Zikirmatik"
          >
            <HandHeartIcon className="w-4 h-4 text-gold-ink" />
          </button>

          {/* Gece/Gündüz Modu Butonu */}
          <button
            onClick={onToggleDarkMode}
            className="p-3.5 rounded-full hover:bg-gold/10 text-ink transition-colors cursor-pointer"
            aria-label={isDarkMode ? 'Gündüz Moduna Geç' : 'Gece Moduna Geç'}
          >
            {isDarkMode ? (
              <SunIcon className="w-4 h-4 text-sand" />
            ) : (
              <MoonIcon className="w-4 h-4 text-gold-ink" />
            )}
          </button>
        </div>
      </div>

      {/* Tarih Şeridi: hicri + miladi, her ekran boyutunda görünür */}
      <div className="px-5 pb-3 flex items-center justify-between border-b border-hairline text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-mist capitalize">{gregorianFormatter.format(date)}</span>
          {isDifferentTimeZone && (
            <span className="text-micro text-mist opacity-75">({location.cityName} saatiyle)</span>
          )}
        </div>
        <span className="text-gold-ink font-medium">{hijriDate.formatted}</span>
      </div>
    </header>
  );
};
