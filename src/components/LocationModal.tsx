import React, { useEffect, useState } from 'react';
import { MagnifyingGlassIcon, MapPinIcon, NavigationArrowIcon, CheckIcon, XIcon } from '@phosphor-icons/react';
import { LocationItem } from '../types';
import { POPULAR_LOCATIONS } from '../data/locations';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-[#D6A84D]/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPinIcon className="w-5 h-5 text-[#D6A84D]" />
            <h3 className="font-serif-title font-bold text-base text-[var(--ink)]">
              Şehir ve Konum Seçimi
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--mist)] cursor-pointer"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 bg-[var(--paper)]">
          <button
            onClick={handleUseGPS}
            disabled={isLocating}
            className="w-full py-2.5 px-4 rounded-xl bg-[#D6A84D] hover:bg-[#c4983e] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <NavigationArrowIcon className="w-4 h-4 animate-spin-slow" />
            <span>
              {isLocating ? 'Konum Alınıyor...' : 'Mevcut Konumumu Otomatik Kullan (GPS)'}
            </span>
          </button>

          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-[var(--mist)] absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Şehir veya ilçe ara (örn: Üsküdar, Ankara, Mekke...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[var(--card-bg)] border border-[#D6A84D]/20 rounded-xl text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#D6A84D]"
            />
          </div>
        </div>

        {searchQuery.trim().length >= 2 && (
          <div className="px-3 pt-1 pb-2 border-b border-[#D6A84D]/10">
            <div className="text-[10px] font-bold text-[var(--mist)] uppercase tracking-wider px-1 mb-1">
              Arama Sonuçları
            </div>

            {searchStatus === 'loading' && (
              <div className="text-center py-4 text-xs text-[var(--mist)]">Aranıyor...</div>
            )}

            {searchStatus === 'error' && (
              <div className="text-center py-4 text-xs text-red-500">
                Arama başarısız, tekrar deneyin.
              </div>
            )}

            {searchStatus === 'no-results' && (
              <div className="text-center py-4 text-xs text-[var(--mist)]">Sonuç bulunamadı.</div>
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
                    className="w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer hover:bg-[var(--paper)] text-[var(--ink)]"
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
                      <div className="text-[10px] text-[var(--mist)]">{loc.country}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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

                {isSelected && <CheckIcon className="w-4 h-4 text-[#D6A84D]" />}
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
