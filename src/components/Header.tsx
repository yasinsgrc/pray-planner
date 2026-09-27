import React, { useMemo } from 'react';
import { MapPinIcon, MoonIcon, SunIcon, CompassIcon, HandHeartIcon } from './icons';
import { LocationItem, HijriDateInfo } from '../types';
import { lineCount } from '../utils/textFit';

interface HeaderProps {
  location: LocationItem;
  hijriDate: HijriDateInfo;
  date: Date;
  /** Selected location's resolved IANA zone — the date strip must read in this zone, not the device's (design-refresh-v3 Faz 4 F3). */
  timeZone: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenLocationModal: () => void;
  onOpenExplore: () => void;
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
  onOpenExplore,
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

  const nameRef = React.useRef<HTMLDivElement>(null);
  const [nameWraps, setNameWraps] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () =>
      setNameWraps(lineCount(el.getBoundingClientRect().height, parseFloat(getComputedStyle(el).lineHeight)) > 1);
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
    document.fonts?.addEventListener('loadingdone', measure);
    return () => {
      resizeObserver.disconnect();
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, [location.isGpsDerived]);

  return (
    <header className="w-full shrink-0 transition-colors pt-[env(safe-area-inset-top)]">
      <div className="px-5 py-4 flex items-center justify-between">
        {/* Sol: Konum */}
        <button
          onClick={onOpenLocationModal}
          className="relative min-w-0 flex items-center gap-2 group text-left cursor-pointer transition-all hover:opacity-80 before:content-[''] before:absolute before:-top-2.5 before:-bottom-2.5 before:inset-x-0"
          aria-label="Konumu Değiştir"
        >
          <div className="w-7 h-7 shrink-0 rounded-full bg-gold/10 flex items-center justify-center text-gold-ink group-hover:bg-gold/20 transition-colors">
            <MapPinIcon className="w-4 h-4" />
          </div>
          {/* GPS'ten gelen bir konum, kullanıcının hiç onaylamadığı bir
              ilçe adını kesin olgu gibi sunmamalı — GPS koordinatı kesin
              ama ona iliştirilen isim en-yakın-merkez tahmini (design-refresh-v3
              Faz 14: Darıca'da GPS "Çayırova" bulmuştu, komşu ve merkezi
              çok yakın bir ilçe). Listeden elle seçilen bir konum içinse
              kullanıcı zaten o ismi onayladığı için ana başlık olarak kalır. */}
          {location.isGpsDerived ? (
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-wide text-ink">
                Mevcut Konum
              </div>
              {/* Konum metni kısaltılmaz; en fazla 2 satıra sarar. */}
              <div data-header-location className="text-label text-mist font-medium line-clamp-2 break-words">
                {location.lat.toFixed(2)}, {location.lng.toFixed(2)} · en yakın merkez: {location.districtName || location.cityName}
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              {/* İlçe • il kısaltılmaz; en fazla 2 satıra sarar. Sardığında
                  (ölçülen satır sayısı > 1) ülke satırı yer açmak için gizlenir. */}
              <div
                ref={nameRef}
                data-header-location
                className="text-xs font-semibold tracking-wide text-ink line-clamp-2 break-words"
              >
                {location.districtName} <span className="text-gold-ink">•</span>{' '}
                <span className="opacity-80">{location.cityName}</span>
              </div>
              {!nameWraps && (
                <div className="text-label text-mist font-medium">
                  {location.country}
                </div>
              )}
            </div>
          )}
        </button>

        {/* Sağ: İkonlar — dokunma hedefi sabit 44px (yazı ölçeğiyle
            büyüyüp konum adının alanını yemesin); ikon rem ile büyür. */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Kıble Butonu */}
          <button
            onClick={onOpenExplore}
            className="size-[44px] flex items-center justify-center rounded-full hover:bg-gold/10 text-ink transition-colors cursor-pointer"
            aria-label="Kıble Pusulası"
          >
            <CompassIcon className="w-4 h-4 text-gold-ink" />
          </button>

          {/* Zikirmatik Butonu */}
          <button
            onClick={onOpenZikirmatikModal}
            className="size-[44px] flex items-center justify-center rounded-full hover:bg-gold/10 text-ink transition-colors cursor-pointer"
            aria-label="Zikirmatik"
          >
            <HandHeartIcon className="w-4 h-4 text-gold-ink" />
          </button>

          {/* Gece/Gündüz Modu Butonu */}
          <button
            onClick={onToggleDarkMode}
            className="size-[44px] flex items-center justify-center rounded-full hover:bg-gold/10 text-ink transition-colors cursor-pointer"
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
      <div className="px-5 pb-3 flex items-center justify-between border-b border-hairline text-[0.6875rem]">
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
