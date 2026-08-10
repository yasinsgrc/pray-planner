import React, { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon, NavigationArrowIcon, CheckIcon, WarningCircleIcon } from './icons';
import { LocationItem } from '../types';
import { POPULAR_LOCATIONS, ALL_LOCATIONS } from '../data/locations';
import { findNearestLocation } from '../utils/geo';
import { resolveGpsDistrictLabel } from '../utils/gpsAccuracy';
import { guessTimeZone } from '../utils/timezone';
import { normalizeTurkish } from '../utils/turkishText';
import { useApiAvailable } from '../hooks/useApiAvailable';
import { apiUrl } from '../utils/apiBaseUrl';
import { BottomSheet } from './BottomSheet';

interface LocationModalProps {
  currentLocation: LocationItem;
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (loc: LocationItem) => void;
}

const LOCAL_RESULT_CAP = 30;
const REMOTE_MIN_LENGTH = 3;

type RemoteStatus = 'idle' | 'loading' | 'error' | 'no-results' | 'rate-limited';

function LocationResultButton({
  loc,
  isSelected,
  onSelect,
}: {
  loc: LocationItem;
  isSelected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
        isSelected ? 'bg-gold/15 text-gold-ink' : 'hover:bg-paper text-ink'
      }`}
    >
      <div>
        <div className="text-sm font-bold">
          {loc.districtName || loc.cityName}
          {loc.districtName && (
            <span className="font-sans text-xs opacity-75 font-normal ml-1">, {loc.cityName}</span>
          )}
        </div>
        <div className="text-[10px] text-mist">{loc.country}</div>
      </div>
      {isSelected && <CheckIcon className="w-4 h-4 text-gold-ink shrink-0" />}
    </button>
  );
}

export const LocationModal: React.FC<LocationModalProps> = ({
  currentLocation,
  isOpen,
  onClose,
  onSelectLocation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>('idle');
  const [remoteResults, setRemoteResults] = useState<LocationItem[]>([]);
  const apiAvailable = useApiAvailable();

  const trimmedQuery = searchQuery.trim();
  const normalizedQuery = normalizeTurkish(trimmedQuery);

  // A previous remote search's result must not linger under a newly typed
  // query — reset as soon as the text changes, so the "İnternette ara"
  // action always reflects the query currently in the box.
  useEffect(() => {
    setRemoteStatus('idle');
    setRemoteResults([]);
  }, [searchQuery]);

  // Local search is the primary path (design-refresh-v3 Faz 6 B1) — it's
  // instant, works fully offline, and covers every il + populous ilçe in
  // Turkey, so the vast majority of searches never need the network at all.
  const localResults = useMemo(() => {
    if (normalizedQuery.length < 2) return [];
    return ALL_LOCATIONS.filter((loc) => {
      return (
        normalizeTurkish(loc.cityName).includes(normalizedQuery) ||
        normalizeTurkish(loc.districtName).includes(normalizedQuery) ||
        normalizeTurkish(loc.country).includes(normalizedQuery)
      );
    }).slice(0, LOCAL_RESULT_CAP);
  }, [normalizedQuery]);

  // Shown only when the search box is empty — once the user is actively
  // searching (normalizedQuery.length >= 2), the "Arama Sonuçları" section
  // above already covers it; showing both at once would mean a
  // 16-entry-only quick-pick list saying "not found" directly under a
  // search-results section that DID find something.
  const showQuickPicks = normalizedQuery.length === 0;

  // Never automatic — Nominatim's usage policy explicitly forbids
  // keystroke-triggered auto-complete search (design-refresh-v3 Faz 6 B1).
  // Only reachable via Enter or an explicit "İnternette ara" action.
  const triggerRemoteSearch = async () => {
    if (trimmedQuery.length < REMOTE_MIN_LENGTH) return;
    setRemoteStatus('loading');
    try {
      const res = await fetch(apiUrl(`/api/geocode?q=${encodeURIComponent(trimmedQuery)}`));
      if (res.status === 503) {
        setRemoteStatus('rate-limited');
        setRemoteResults([]);
        return;
      }
      if (!res.ok) {
        setRemoteStatus('error');
        setRemoteResults([]);
        return;
      }
      const data = await res.json();
      // server/geocoding.ts (off-limits to edit) never sets timeZone —
      // fill it in client-side so results display in their own zone.
      const results: LocationItem[] = (data.results ?? []).map((loc: LocationItem) => ({
        ...loc,
        timeZone: loc.timeZone ?? guessTimeZone(loc.lat, loc.lng),
      }));
      setRemoteResults(results);
      setRemoteStatus(results.length === 0 ? 'no-results' : 'idle');
    } catch {
      setRemoteStatus('error');
      setRemoteResults([]);
    }
  };

  const canSearchRemote = apiAvailable === true && trimmedQuery.length >= REMOTE_MIN_LENGTH;

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setGpsError('Cihazınızda GPS desteği bulunamadı.');
      return;
    }

    setGpsError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        // Never sent to any server — reverse-geocoding was removed
        // entirely (design-refresh-v3 Faz 16): it silently sent the
        // user's exact GPS coordinate to the backend on every tap of this
        // button, which is precisely the automatic, invisible coordinate
        // exposure the "Mevcut Konum" honesty decision (Faz 14) requires
        // there be none of. The nearest known city's name is only ever a
        // label (Header shows "Mevcut Konum", not this name, as the
        // primary heading) — the real GPS coordinate is what's actually
        // used for prayer time calculation, entirely on-device.
        const nearest = findNearestLocation(latitude, longitude);
        const resolvedLoc: LocationItem = {
          ...nearest,
          // Faz 24 Commit 3 — a specific district guess is even less
          // trustworthy than usual when the GPS fix itself is poor;
          // resolveGpsDistrictLabel drops to the province name past 1000m.
          districtName: resolveGpsDistrictLabel(nearest, accuracy),
          id: `gps-${Date.now()}`,
          lat: latitude,
          lng: longitude,
          isGpsDerived: true,
        };

        setIsLocating(false);
        onSelectLocation(resolvedLoc);
        onClose();
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError('Konum izni verilmedi. Tarayıcı ayarlarından konum iznini açabilirsiniz.');
        } else if (error.code === error.TIMEOUT) {
          setGpsError('Konum alma zaman aşımına uğradı. Tekrar deneyebilir veya listeden şehir seçebilirsiniz.');
        } else {
          setGpsError('Konum alınamadı. Aşağıdaki listeden şehir seçebilirsiniz.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                triggerRemoteSearch();
              }
            }}
            className="w-full min-h-[44px] pl-9 pr-4 py-2.5 bg-paper border border-gold/20 rounded-xl text-xs font-medium text-ink focus:outline-none focus:border-gold"
          />
        </div>

        {normalizedQuery.length >= 2 && (
          <div className="pt-1 pb-2 border-b border-gold/10">
            <div className="text-label font-bold text-mist px-1 mb-1">Arama Sonuçları</div>

            {localResults.length > 0 ? (
              <div className="space-y-1">
                {localResults.map((loc) => (
                  <LocationResultButton
                    key={loc.id}
                    loc={loc}
                    onSelect={() => {
                      onSelectLocation(loc);
                      onClose();
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-mist">
                Sonuç bulunamadı — il adıyla aramayı deneyin.
              </div>
            )}

            {/* Remote search is always an explicit, secondary action — never
                automatic. Demoted to a subtle link when local already found
                something, promoted to a full button when it didn't. */}
            {canSearchRemote && (
              <div className="mt-2">
                {localResults.length === 0 ? (
                  <button
                    onClick={triggerRemoteSearch}
                    disabled={remoteStatus === 'loading'}
                    className="w-full min-h-[40px] px-4 rounded-xl bg-paper border border-hairline text-xs font-semibold text-gold-ink cursor-pointer hover:bg-gold/10 transition-colors disabled:opacity-60"
                  >
                    {remoteStatus === 'loading' ? 'Aranıyor...' : 'İnternette Ara'}
                  </button>
                ) : (
                  <button
                    onClick={triggerRemoteSearch}
                    disabled={remoteStatus === 'loading'}
                    className="text-[11px] text-mist underline underline-offset-2 cursor-pointer disabled:opacity-60"
                  >
                    {remoteStatus === 'loading'
                      ? 'Aranıyor...'
                      : 'Aradığınızı bulamadınız mı? İnternette ara'}
                  </button>
                )}

                {remoteStatus === 'error' && (
                  <div className="text-center py-2 text-xs text-danger-ink">
                    Arama başarısız, tekrar deneyin.
                  </div>
                )}
                {remoteStatus === 'rate-limited' && (
                  <div className="text-center py-2 text-xs text-mist">
                    Arama servisi şu an yoğun, listeden seçebilirsiniz.
                  </div>
                )}
                {remoteStatus === 'no-results' && (
                  <div className="text-center py-2 text-xs text-mist">İnternette de sonuç bulunamadı.</div>
                )}

                {remoteResults.length > 0 && (
                  <>
                    <div className="space-y-1 mt-2">
                      {remoteResults.map((loc) => (
                        <LocationResultButton
                          key={loc.id}
                          loc={loc}
                          onSelect={() => {
                            onSelectLocation(loc);
                            onClose();
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-micro text-mist text-center pt-2">
                      Sonuçlar{' '}
                      <a
                        href="https://www.openstreetmap.org/copyright"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        © OpenStreetMap katkıcıları
                      </a>
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {showQuickPicks && (
          <div className="space-y-1 divide-y divide-hairline">
            {POPULAR_LOCATIONS.map((loc) => (
              <LocationResultButton
                key={loc.id}
                loc={loc}
                isSelected={loc.id === currentLocation.id}
                onSelect={() => {
                  onSelectLocation(loc);
                  onClose();
                }}
              />
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
