import React, { useEffect, useRef } from 'react';
import { CompassIcon, XIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { LocationItem } from '../types';
import { useCompassHeading } from '../hooks/useCompassHeading';
import { isAlignedWithBearing } from '../utils/compassHeading';

interface QiblaCompassModalProps {
  location: LocationItem;
  isOpen: boolean;
  onClose: () => void;
}

export const QiblaCompassModal: React.FC<QiblaCompassModalProps> = ({
  location,
  isOpen,
  onClose,
}) => {
  const { heading, permissionState, requestPermission } = useCompassHeading(isOpen);
  const wasAlignedRef = useRef(false);

  // Calculate Qibla bearing from user coordinates to Kaaba (Makkah: 21.4225 N, 39.8262 E)
  const kaabaLat = (21.4225 * Math.PI) / 180;
  const kaabaLng = (39.8262 * Math.PI) / 180;
  const userLat = (location.lat * Math.PI) / 180;
  const userLng = (location.lng * Math.PI) / 180;

  const y = Math.sin(kaabaLng - userLng);
  const x =
    Math.cos(userLat) * Math.tan(kaabaLat) -
    Math.sin(userLat) * Math.cos(kaabaLng - userLng);

  let qiblaBearing = (Math.atan2(y, x) * 180) / Math.PI;
  qiblaBearing = (qiblaBearing + 360) % 360;
  const qiblaFormatted = Math.round(qiblaBearing);

  const needleRotation =
    heading !== null ? (qiblaBearing - heading + 360) % 360 : qiblaBearing;
  const aligned = heading !== null && isAlignedWithBearing(qiblaBearing, heading, 5);

  useEffect(() => {
    if (aligned && !wasAlignedRef.current && navigator.vibrate) {
      navigator.vibrate(50);
    }
    wasAlignedRef.current = aligned;
  }, [aligned]);

  if (!isOpen) return null;

  const needleColorClass = aligned ? 'text-emerald-500' : 'text-[#D6A84D]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-xl p-5 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[#D6A84D]/15 pb-3">
          <div className="flex items-center gap-2 text-left">
            <CompassIcon className="w-5 h-5 text-[#D6A84D]" />
            <div>
              <h3 className="font-serif-title font-bold text-base text-[var(--ink)]">
                Kıble Pusulası
              </h3>
              <p className="text-[10px] text-[var(--mist)]">
                {location.districtName}, {location.cityName} için derece açısı
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--mist)] cursor-pointer"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Pusula Görsel Alanı */}
        <div
          className={`relative w-52 h-52 mx-auto my-4 flex items-center justify-center rounded-full border-2 bg-[var(--paper)] shadow-inner transition-colors duration-300 ${
            aligned ? 'border-emerald-500/50' : 'border-[#D6A84D]/30'
          }`}
        >
          {/* Kuzey / Güney / Doğu / Batı İşaretleri */}
          <span className="absolute top-2 text-[10px] font-bold text-red-500">N (Kuzey)</span>
          <span className="absolute bottom-2 text-[10px] font-bold text-[var(--mist)]">S (Güney)</span>
          <span className="absolute right-2 text-[10px] font-bold text-[var(--mist)]">E (Doğu)</span>
          <span className="absolute left-2 text-[10px] font-bold text-[var(--mist)]">W (Batı)</span>

          {/* Dönen Kıble İbresi */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-700 ease-out"
            style={{ transform: `rotate(${needleRotation}deg)` }}
          >
            <div className="flex flex-col items-center justify-start h-full py-3">
              {/* Kâbe Simgesi / Altın İbre Başı */}
              <div
                className={`w-7 h-7 rounded-lg bg-[#2D2D2D] border-2 flex items-center justify-center shadow-md transition-colors duration-300 ${
                  aligned ? 'border-emerald-500' : 'border-[#D6A84D]'
                }`}
              >
                <span className={`text-[10px] font-bold ${needleColorClass}`}>KÂBE</span>
              </div>
              <div
                className={`w-0.5 h-16 transition-colors duration-300 ${
                  aligned ? 'bg-emerald-500' : 'bg-[#D6A84D]'
                }`}
              />
            </div>
          </div>

          {/* Merkez Nokta */}
          <div
            className={`w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 transition-colors duration-300 ${
              aligned ? 'bg-emerald-500' : 'bg-[#D6A84D]'
            }`}
          />
        </div>

        <div className="p-3 rounded-xl bg-[#D6A84D]/10 border border-[#D6A84D]/20 text-xs">
          <div className="text-[11px] text-[var(--mist)]">Kâbe-i Muazzama Açısı</div>
          <div className="font-numbers text-xl font-extrabold text-[#D6A84D] mt-0.5">
            {qiblaFormatted}°
          </div>
          <p className="text-[10px] text-[var(--mist)] mt-1">
            Telefonunuzu düz bir zemin üzerinde tutarak pusula ibresini Kâbe yönüne çeviriniz.
          </p>
        </div>

        {permissionState === 'idle' && (
          <button
            onClick={requestPermission}
            className="w-full py-2.5 px-4 rounded-xl bg-[#D6A84D] hover:bg-[#c4983e] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <CompassIcon className="w-4 h-4" />
            <span>Pusulayı Etkinleştir</span>
          </button>
        )}

        {permissionState === 'denied' && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-left">
            <WarningCircleIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] text-red-500">
                İzin reddedildi. Tarayıcı ayarlarından hareket sensörü iznini açıp tekrar deneyin.
              </p>
              <button
                onClick={requestPermission}
                className="text-[11px] font-semibold text-[#D6A84D] hover:underline cursor-pointer mt-1"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        )}

        {permissionState === 'unsupported' && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-left">
            <WarningCircleIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] text-red-500">
                Cihazınız pusula sensörünü desteklemiyor, açı bilgisini yukarıdan kullanabilirsiniz.
              </p>
              <button
                onClick={requestPermission}
                className="text-[11px] font-semibold text-[#D6A84D] hover:underline cursor-pointer mt-1"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        )}

        {aligned && (
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            Kıble yönüne hizalandınız
          </p>
        )}
      </div>
    </div>
  );
};
