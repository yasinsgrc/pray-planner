import React from 'react';
import { MapPinIcon, MoonIcon, SunIcon, CompassIcon, HandHeartIcon } from '@phosphor-icons/react';
import { LocationItem, HijriDateInfo } from '../types';

interface HeaderProps {
  location: LocationItem;
  hijriDate: HijriDateInfo;
  date: Date;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenLocationModal: () => void;
  onOpenQiblaModal: () => void;
  onOpenZikirmatikModal: () => void;
}

const gregorianFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  weekday: 'long',
});

export const Header: React.FC<HeaderProps> = ({
  location,
  hijriDate,
  date,
  isDarkMode,
  onToggleDarkMode,
  onOpenLocationModal,
  onOpenQiblaModal,
  onOpenZikirmatikModal,
}) => {
  return (
    <header className="w-full transition-colors">
      <div className="px-5 py-4 flex items-center justify-between">
        {/* Sol: Konum */}
        <button
          onClick={onOpenLocationModal}
          className="flex items-center gap-2 group text-left cursor-pointer transition-all hover:opacity-80"
          aria-label="Konumu Değiştir"
        >
          <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-gold group-hover:bg-gold/20 transition-colors">
            <MapPinIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold tracking-wide text-ink flex items-center gap-1">
              <span>{location.districtName}</span>
              <span className="text-gold">•</span>
              <span className="opacity-80">{location.cityName}</span>
            </div>
            <div className="text-[10px] text-mist uppercase tracking-wider font-medium">
              {location.country}
            </div>
          </div>
        </button>

        {/* Sağ: İkonlar */}
        <div className="flex items-center gap-1">
          {/* Kıble Butonu */}
          <button
            onClick={onOpenQiblaModal}
            className="p-3.5 rounded-full hover:bg-gold/10 text-ink transition-colors cursor-pointer"
            aria-label="Kıble Pusulası"
          >
            <CompassIcon className="w-4 h-4 text-gold" />
          </button>

          {/* Zikirmatik Butonu */}
          <button
            onClick={onOpenZikirmatikModal}
            className="p-3.5 rounded-full hover:bg-gold/10 text-ink transition-colors cursor-pointer"
            aria-label="Zikirmatik"
          >
            <HandHeartIcon className="w-4 h-4 text-gold" />
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
              <MoonIcon className="w-4 h-4 text-gold" />
            )}
          </button>
        </div>
      </div>

      {/* Tarih Şeridi: hicri + miladi, her ekran boyutunda görünür */}
      <div className="px-5 pb-3 flex items-center justify-between border-b border-hairline text-[11px]">
        <span className="text-mist capitalize">{gregorianFormatter.format(date)}</span>
        <span className="text-gold font-medium">{hijriDate.formatted}</span>
      </div>
    </header>
  );
};
