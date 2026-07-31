import React from 'react';
import { MapPin, Moon, Sun, Compass, HeartHandshake } from 'lucide-react';
import { LocationItem, HijriDateInfo } from '../types';

interface HeaderProps {
  location: LocationItem;
  hijriDate: HijriDateInfo;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenLocationModal: () => void;
  onOpenQiblaModal: () => void;
  onOpenZikirmatikModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  location,
  hijriDate,
  isDarkMode,
  onToggleDarkMode,
  onOpenLocationModal,
  onOpenQiblaModal,
  onOpenZikirmatikModal,
}) => {
  return (
    <header className="w-full px-5 py-4 flex items-center justify-between border-b border-[#D6A84D]/15 transition-colors">
      {/* Sol: Konum */}
      <button
        onClick={onOpenLocationModal}
        className="flex items-center gap-2 group text-left cursor-pointer transition-all hover:opacity-80"
        title="Konumu Değiştir"
      >
        <div className="w-7 h-7 rounded-full bg-[#D6A84D]/10 flex items-center justify-center text-[#D6A84D] group-hover:bg-[#D6A84D]/20 transition-colors">
          <MapPin className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-semibold tracking-wide text-[var(--ink)] flex items-center gap-1">
            <span>{location.districtName}</span>
            <span className="text-[#D6A84D]">•</span>
            <span className="opacity-80">{location.cityName}</span>
          </div>
          <div className="text-[10px] text-[var(--mist)] uppercase tracking-wider font-medium">
            {location.country}
          </div>
        </div>
      </button>

      {/* Sağ: İkonlar ve Hicri Takvim */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right pr-2 border-r border-[#D6A84D]/20">
          <div className="text-xs font-serif-title text-[#D6A84D] font-medium tracking-wide">
            {hijriDate.formatted}
          </div>
          <div className="text-[10px] text-[var(--mist)]">Hicri Takvim</div>
        </div>

        {/* Kıble Butonu */}
        <button
          onClick={onOpenQiblaModal}
          className="p-2 rounded-full hover:bg-[#D6A84D]/10 text-[var(--ink)] transition-colors cursor-pointer"
          title="Kıble Pusulası"
        >
          <Compass className="w-4 h-4 text-[#D6A84D]" />
        </button>

        {/* Zikirmatik Butonu */}
        <button
          onClick={onOpenZikirmatikModal}
          className="p-2 rounded-full hover:bg-[#D6A84D]/10 text-[var(--ink)] transition-colors cursor-pointer"
          title="Zikirmatik"
        >
          <HeartHandshake className="w-4 h-4 text-[#D6A84D]" />
        </button>

        {/* Gece/Gündüz Modu Butonu */}
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-full hover:bg-[#D6A84D]/10 text-[var(--ink)] transition-colors cursor-pointer"
          title={isDarkMode ? 'Gündüz Moduna Geç' : 'Gece Moduna Geç'}
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-[#E8C68C]" />
          ) : (
            <Moon className="w-4 h-4 text-[#D6A84D]" />
          )}
        </button>
      </div>
    </header>
  );
};
