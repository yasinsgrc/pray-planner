import React, { useEffect, useMemo, useState } from 'react';
import { AppLauncher } from '@capacitor/app-launcher';
import { MapPinIcon, WarningCircleIcon } from './icons';
import { findNearby, Place, PlaceCategory, PlaceIndex } from '../lib/places/query';
import { formatDistance } from '../lib/places/formatDistance';
import { buildGoogleMapsUrl } from '../lib/places/mapsLink';
import { getGpsErrorMessage } from '../utils/gpsError';
import { isNativePlatform } from '../utils/platform';

const CATEGORY_CHIPS: { value: PlaceCategory; label: string; emptyNoun: string }[] = [
  { value: 'cami', label: 'Camiler', emptyNoun: 'cami' },
  { value: 'turbe', label: 'Türbeler', emptyNoun: 'türbe' },
  { value: 'tarihi', label: 'Tarihi', emptyNoun: 'tarihi yer' },
];

const GEOLOCATION_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 };

type PermissionState = 'prompt' | 'denied';

function PlaceRow({ place }: { place: Place }) {
  return (
    <button
      onClick={() => AppLauncher.openUrl({ url: buildGoogleMapsUrl(place.name, place.lat, place.lon) })}
      className="rounded-xl p-4 bg-card/70 border border-hairline/50 flex items-center gap-3.5 text-left cursor-pointer"
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gold/10 text-gold-ink shrink-0">
        <MapPinIcon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-base font-bold text-ink truncate">{place.name}</p>
        {place.category === 'turbe' && <p className="text-micro text-mist">Türbe</p>}
        <p className="text-micro text-mist mt-0.5">{formatDistance(place.distanceMeters)}</p>
      </div>
    </button>
  );
}

function CenteredMessage({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4 text-center">
      {icon}
      <p className="text-sm font-semibold text-ink mt-3">{title}</p>
      <p className="text-[11px] text-mist mt-1 max-w-[240px]">{description}</p>
      {action}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2 px-4 pt-4" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-[68px] rounded-xl bg-card border border-hairline animate-pulse" />
      ))}
    </div>
  );
}

export const NearbyView: React.FC = () => {
  const [category, setCategory] = useState<PlaceCategory>('cami');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [permission, setPermission] = useState<PermissionState>('prompt');
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [placeIndex, setPlaceIndex] = useState<PlaceIndex | null>(null);

  // index.json dinamik import ile — ana JS paketine girmez, ilk paint'i
  // bloklamaz. Mount olur olmaz tetiklenir, konum izniyle paralel çalışır.
  useEffect(() => {
    let cancelled = false;
    import('../assets/places/index.json').then((mod) => {
      // TS, dinamik import'ta gerçek dosya içeriğinden ~19k kayıtlık dev bir
      // literal tip çıkarıyor (c alanı number'a genişliyor) — gerçek şekil
      // zaten PlaceIndex ile birebir aynı (bkz. scripts/places/transform.ts).
      if (!cancelled) setPlaceIndex(mod.default as unknown as PlaceIndex);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Cihazınızda GPS desteği bulunamadı.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setPermission('denied');
        } else {
          setLocationError(getGpsErrorMessage(error.code, isNativePlatform()));
        }
      },
      GEOLOCATION_OPTIONS
    );
  };

  // Mevcut konum servisiyle aynı izin okuma yolu (App.tsx'teki location
  // drift kontrolüyle aynı desen) — zaten verilmişse kullanıcıya buton
  // gösterip tekrar sormaya gerek yok, zaten reddedilmişse doğrudan
  // ayarlara yönlendiren mesajı göster.
  useEffect(() => {
    if (!('permissions' in navigator)) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (cancelled) return;
        if (status.state === 'granted') requestLocation();
        else if (status.state === 'denied') setPermission('denied');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const places = useMemo(() => {
    if (!placeIndex || !coords) return null;
    return findNearby(placeIndex, coords.lat, coords.lng, category, 30);
  }, [placeIndex, coords, category]);

  const activeChip = CATEGORY_CHIPS.find((c) => c.value === category)!;

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex gap-2 px-4 pt-3">
        {CATEGORY_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setCategory(chip.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer border ${
              category === chip.value
                ? 'bg-gold text-on-gold border-gold'
                : 'bg-card text-ink border-hairline hover:bg-paper'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {permission === 'denied' ? (
        <CenteredMessage
          icon={<WarningCircleIcon className="w-8 h-8 text-danger-ink/60" />}
          title="Konum izni verilmedi"
          description={getGpsErrorMessage(1, isNativePlatform())}
        />
      ) : locationError ? (
        <CenteredMessage
          icon={<WarningCircleIcon className="w-8 h-8 text-danger-ink/60" />}
          title="Konum alınamadı"
          description={locationError}
          action={
            <button
              onClick={requestLocation}
              className="mt-4 px-4 py-2 rounded-xl bg-gold text-on-gold text-sm font-bold cursor-pointer"
            >
              Tekrar Dene
            </button>
          }
        />
      ) : !coords ? (
        isLocating ? (
          <Skeleton />
        ) : (
          <CenteredMessage
            icon={<MapPinIcon className="w-8 h-8 text-gold/40" />}
            title="Yakınımdaki yerleri görmek için konum izni gerekiyor"
            description="Cami, türbe ve tarihi yerleri size en yakından uzağa doğru listeleyebilmemiz için konumunuzu kullanmamıza izin verin."
            action={
              <button
                onClick={requestLocation}
                className="mt-4 px-4 py-2 rounded-xl bg-gold text-on-gold text-sm font-bold cursor-pointer"
              >
                Konumumu Kullan
              </button>
            }
          />
        )
      ) : !places ? (
        <Skeleton />
      ) : places.length === 0 ? (
        <CenteredMessage
          icon={<MapPinIcon className="w-8 h-8 text-gold/40" />}
          title="Sonuç bulunamadı"
          description={`Bu bölgede kayıtlı ${activeChip.emptyNoun} bulunamadı.`}
        />
      ) : (
        <div className="flex flex-col gap-2 px-4 pt-4 pb-4">
          {places.map((place) => (
            <PlaceRow key={`${place.lat},${place.lon},${place.name}`} place={place} />
          ))}
        </div>
      )}
      <p className="text-micro text-mist text-center py-2">
        Mekân verileri{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          © OpenStreetMap katkıcıları (ODbL)
        </a>
      </p>
    </div>
  );
};
