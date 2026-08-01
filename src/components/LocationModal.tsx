import React, { useEffect, useState } from 'react';
import { MagnifyingGlassIcon, NavigationArrowIcon, CheckIcon } from '@phosphor-icons/react';
import { LocationItem } from '../types';
import { POPULAR_LOCATIONS } from '../data/locations';
import { BottomSheet } from './BottomSheet';

interface LocationModalProps {
  currentLocation: LocationItem;
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (loc: LocationItem) => void;
}

type SearchStatus = 'idle' | 'loading' | 'error' | 'no-results';

export const LocationModal: React.FC<LocationModalProps> = ({
  currentLocation,
  isOpen,
  onClose,
  onSelectLocation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationItem[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');

  useEffect(() => {
    const trimmed = searchQuery.trim();

    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchStatus('idle');
      return;
    }

    setSearchStatus('loading');

    let ignore = false;

    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
        if (ignore) return;
        if (!res.ok) {
          setSearchStatus('error');
          setSearchResults([]);
          return;
        }
        const data = await res.json();
        if (ignore) return;
        const results: LocationItem[] = data.results ?? [];
        setSearchResults(results);
        setSearchStatus(results.length === 0 ? 'no-results' : 'idle');
      } catch {
        if (ignore) return;
        setSearchStatus('error');
        setSearchResults([]);
      }
    }, 400);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery.trim()]);

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
      async (pos) => {
        const fallbackLoc: LocationItem = {
          id: `gps-${Date.now()}`,
          cityName: 'Mevcut Konum',
          districtName: 'GPS Tespiti',
          country: 'Türkiye',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        try {
          const res = await fetch(
            `/api/reverse-geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.location) {
              setIsLocating(false);
              onSelectLocation({ ...data.location, id: `gps-${Date.now()}` });
              onClose();
              return;
            }
          }
        } catch {
          // Ağ hatası: sessizce sabit etikete düş
        }

        setIsLocating(false);
        onSelectLocation(fallbackLoc);
        onClose();
      },
      () => {
        setIsLocating(false);
        alert('GPS konumu alınamadı. Varsayılan listeden şehir seçebilirsiniz.');
      }
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Şehir ve Konum Seçimi">
      <div className="space-y-3 pb-2">
        <button
          onClick={handleUseGPS}
          disabled={isLocating}
          className="w-full py-2.5 px-4 rounded-xl bg-gold hover:bg-[#c4983e] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <NavigationArrowIcon className="w-4 h-4 animate-spin-slow" />
          <span>
            {isLocating ? 'Konum Alınıyor...' : 'Mevcut Konumumu Otomatik Kullan (GPS)'}
          </span>
        </button>

        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 text-mist absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Şehir veya ilçe ara (örn: Üsküdar, Ankara, Mekke...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-paper border border-gold/20 rounded-xl text-xs font-medium text-ink focus:outline-none focus:border-gold"
          />
        </div>

        {searchQuery.trim().length >= 2 && (
          <div className="pt-1 pb-2 border-b border-gold/10">
            <div className="text-[10px] font-bold text-mist uppercase tracking-wider px-1 mb-1">
              Arama Sonuçları
            </div>

            {searchStatus === 'loading' && (
              <div className="text-center py-4 text-xs text-mist">Aranıyor...</div>
            )}

            {searchStatus === 'error' && (
              <div className="text-center py-4 text-xs text-red-500">
                Arama başarısız, tekrar deneyin.
              </div>
            )}

            {searchStatus === 'no-results' && (
              <div className="text-center py-4 text-xs text-mist">
                Sonuç bulunamadı. İlçe yerine il adıyla arayın.
              </div>
            )}

            {searchStatus === 'idle' && searchResults.length > 0 && (
              <div className="space-y-1">
                {searchResults.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => {
                      onSelectLocation(loc);
                      onClose();
                    }}
                    className="w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer hover:bg-paper text-ink"
                  >
                    <div>
                      <div className="text-sm font-bold font-serif-title">
                        {loc.districtName || loc.cityName}
                        {loc.districtName && (
                          <span className="font-sans text-xs opacity-75 font-normal ml-1">
                            , {loc.cityName}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-mist">{loc.country}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1 divide-y divide-gray-100 dark:divide-gray-800/40">
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
                    ? 'bg-gold/15 text-gold'
                    : 'hover:bg-paper text-ink'
                }`}
              >
                <div>
                  <div className="text-sm font-bold font-serif-title">
                    {loc.districtName}
                    <span className="font-sans text-xs opacity-75 font-normal ml-1">
                      , {loc.cityName}
                    </span>
                  </div>
                  <div className="text-[10px] text-mist">{loc.country}</div>
                </div>

                {isSelected && <CheckIcon className="w-4 h-4 text-gold" />}
              </button>
            );
          })}

          {filteredLocations.length === 0 && (
            <div className="text-center py-8 text-xs text-mist">
              Aramanıza uygun şehir bulunamadı.
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
