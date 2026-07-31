import React, { useState } from 'react';
import { Search, MapPin, Navigation, Check, X } from 'lucide-react';
import { LocationItem } from '../types';
import { POPULAR_LOCATIONS } from '../data/locations';

interface LocationModalProps {
  currentLocation: LocationItem;
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (loc: LocationItem) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  currentLocation,
  isOpen,
  onClose,
  onSelectLocation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  if (!isOpen) return null;

  const filteredLocations = POPULAR_LOCATIONS.filter((loc) => {
    const q = searchQuery.toLowerCase();
    return (
      loc.cityName.toLowerCase().includes(q) ||
      loc.districtName.toLowerCase().includes(q) ||
      loc.country.toLowerCase().includes(q)
    );
  });

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      alert('Cihazınızda GPS desteği bulunamadı.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const userLoc: LocationItem = {
          id: `gps-${Date.now()}`,
          cityName: 'Mevcut Konum',
          districtName: 'GPS Tespiti',
          country: 'Türkiye',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        onSelectLocation(userLoc);
        onClose();
      },
      (err) => {
        setIsLocating(false);
        alert('GPS konumu alınamadı. Varsayılan listeden şehir seçebilirsiniz.');
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Üst Başlık */}
        <div className="p-4 border-b border-[#D6A84D]/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#D6A84D]" />
            <h3 className="font-serif-title font-bold text-base text-[var(--ink)]">
              Şehir ve Konum Seçimi
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--mist)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GPS Butonu ve Arama Kutusu */}
        <div className="p-4 space-y-3 bg-[var(--paper)]">
          <button
            onClick={handleUseGPS}
            disabled={isLocating}
            className="w-full py-2.5 px-4 rounded-xl bg-[#D6A84D] hover:bg-[#c4983e] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Navigation className="w-4 h-4 animate-spin-slow" />
            <span>
              {isLocating ? 'Konum Alınıyor...' : 'Mevcut Konumumu Otomatik Kullan (GPS)'}
            </span>
          </button>

          <div className="relative">
            <Search className="w-4 h-4 text-[var(--mist)] absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Şehir veya ilçe ara (örn: Üsküdar, Ankara, Mekke...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[var(--card-bg)] border border-[#D6A84D]/20 rounded-xl text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#D6A84D]"
            />
          </div>
        </div>

        {/* Konum Listesi */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 divide-y divide-gray-100 dark:divide-gray-800/40">
          {filteredLocations.map((loc) => {
            const isSelected = loc.id === currentLocation.id;

            return (
              <button
                key={loc.id}
                onClick={() => {
                  onSelectLocation(loc);
                  onClose();
                }}
                className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#D6A84D]/15 text-[#D6A84D]'
                    : 'hover:bg-[var(--paper)] text-[var(--ink)]'
                }`}
              >
                <div>
                  <div className="text-sm font-bold font-serif-title">
                    {loc.districtName}
                    <span className="font-sans text-xs opacity-75 font-normal ml-1">
                      , {loc.cityName}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--mist)]">{loc.country}</div>
                </div>

                {isSelected && <Check className="w-4 h-4 text-[#D6A84D]" />}
              </button>
            );
          })}

          {filteredLocations.length === 0 && (
            <div className="text-center py-8 text-xs text-[var(--mist)]">
              Aramanıza uygun şehir bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
