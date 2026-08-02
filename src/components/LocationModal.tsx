import React, { useEffect, useState } from 'react';
import { MagnifyingGlassIcon, NavigationArrowIcon, CheckIcon, WarningCircleIcon } from './icons';
import { LocationItem } from '../types';
import { POPULAR_LOCATIONS } from '../data/locations';
import { findNearestLocation } from '../utils/geo';
import { guessTimeZone } from '../utils/timezone';
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
  const [gpsError, setGpsError] = useState<string | null>(null);
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
        // server/geocoding.ts (off-limits to edit) never sets timeZone —
        // fill it in client-side so results display in their own zone.
        const results: LocationItem[] = (data.results ?? []).map((loc: LocationItem) => ({
          ...loc,
          timeZone: loc.timeZone ?? guessTimeZone(loc.lat, loc.lng),
        }));
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
      setGpsError('Cihazınızda GPS desteği bulunamadı.');
      return;
    }

    setGpsError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Nearest known city's name paired with the GPS's own precise
        // coordinates — used both as the immediate result and as the
        // fallback if reverse-geocoding fails or there's no backend at
        // all (this app can be deployed statically, without the Express
        // server, in which case /api/reverse-geocode always 404s).
        const nearest = findNearestLocation(latitude, longitude);
        const fallbackLoc: LocationItem = {
          ...nearest,
          id: `gps-${Date.now()}`,
          lat: latitude,
          lng: longitude,
        };

        try {
          const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lng=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (data.location) {
              setIsLocating(false);
              onSelectLocation({
                ...data.location,
                id: `gps-${Date.now()}`,
                timeZone: data.location.timeZone ?? guessTimeZone(data.location.lat, data.location.lng),
              });
              onClose();
              return;
            }
          }
        } catch {
          // Ağ hatası: sessizce en yakın bilinen şehre düş
        }

        setIsLocating(false);
        onSelectLocation(fallbackLoc);
        onClose();
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError('Konum izni verilmedi. Tarayıcı ayarlarından konum iznini açabilirsiniz.');
        } else {
          setGpsError('Konum alınamadı. Aşağıdaki listeden şehir seçebilirsiniz.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Şehir ve Konum Seçimi">
      <div className="space-y-3 pb-2">
        <button
          onClick={handleUseGPS}
          disabled={isLocating}
          className="w-full min-h-[48px] px-4 rounded-xl bg-gold hover:bg-gold-hover text-on-gold font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <NavigationArrowIcon className="w-4 h-4 animate-spin-slow" />
          <span>
            {isLocating ? 'Konum Alınıyor...' : 'Mevcut Konumumu Otomatik Kullan (GPS)'}
          </span>
        </button>

        {gpsError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 text-left">
            <WarningCircleIcon className="w-4 h-4 text-danger-ink shrink-0 mt-0.5" />
            <p className="text-[11px] text-danger-ink">{gpsError}</p>
          </div>
        )}

        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 text-mist absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Şehir veya ilçe ara (örn: Üsküdar, Ankara, Mekke...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[44px] pl-9 pr-4 py-2.5 bg-paper border border-gold/20 rounded-xl text-xs font-medium text-ink focus:outline-none focus:border-gold"
          />
        </div>

        {searchQuery.trim().length >= 2 && (
          <div className="pt-1 pb-2 border-b border-gold/10">
            <div className="text-label font-bold text-mist px-1 mb-1">
              Arama Sonuçları
            </div>

            {searchStatus === 'loading' && (
              <div className="text-center py-4 text-xs text-mist">Aranıyor...</div>
            )}

            {searchStatus === 'error' && (
              <div className="text-center py-4 text-xs text-danger-ink">
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
                      <div className="text-sm font-bold">
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

        <div className="space-y-1 divide-y divide-hairline">
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
                    ? 'bg-gold/15 text-gold-ink'
                    : 'hover:bg-paper text-ink'
                }`}
              >
                <div>
                  <div className="text-sm font-bold">
                    {loc.districtName}
                    <span className="font-sans text-xs opacity-75 font-normal ml-1">
                      , {loc.cityName}
                    </span>
                  </div>
                  <div className="text-[10px] text-mist">{loc.country}</div>
                </div>

                {isSelected && <CheckIcon className="w-4 h-4 text-gold-ink" />}
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
