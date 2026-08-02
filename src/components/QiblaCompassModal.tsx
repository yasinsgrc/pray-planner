import React, { useEffect, useRef } from 'react';
import { CompassIcon, WarningCircleIcon } from './icons';
import { LocationItem } from '../types';
import { useCompassHeading } from '../hooks/useCompassHeading';
import { isAlignedWithBearing } from '../utils/compassHeading';
import { calculateQiblaBearing } from '../utils/qibla';
import { BottomSheet } from './BottomSheet';

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

  const qiblaBearing = calculateQiblaBearing(location);
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

  const needleColorClass = aligned ? 'text-success' : 'text-gold';

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Kıble Pusulası">
      <div className="text-center space-y-4 pb-2">
        <p className="text-[11px] text-mist -mt-2">
          {location.districtName}, {location.cityName} için derece açısı
        </p>

        {/* Pusula Görsel Alanı */}
        <div
          className={`relative w-52 h-52 mx-auto flex items-center justify-center rounded-full border-2 bg-paper shadow-inner transition-colors duration-300 ${
            aligned ? 'border-success/50' : 'border-gold/30'
          }`}
        >
          {/* Kuzey / Güney / Doğu / Batı İşaretleri */}
          <span className="absolute top-2 text-[10px] font-bold text-danger-ink">N (Kuzey)</span>
          <span className="absolute bottom-2 text-[10px] font-bold text-mist">S (Güney)</span>
          <span className="absolute right-2 text-[10px] font-bold text-mist">E (Doğu)</span>
          <span className="absolute left-2 text-[10px] font-bold text-mist">W (Batı)</span>

          {/* Dönen Kıble İbresi */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-700 ease-out"
            style={{ transform: `rotate(${needleRotation}deg)` }}
          >
            <div className="flex flex-col items-center justify-start h-full py-3">
              {/* Kâbe Simgesi / Altın İbre Başı — bilerek temadan bağımsız koyu (gerçek Kâbe rengi) */}
              <div
                className={`w-7 h-7 rounded-lg bg-[#2D2D2D] border-2 flex items-center justify-center shadow-md transition-colors duration-300 ${
                  aligned ? 'border-success' : 'border-gold'
                }`}
              >
                <span className={`text-[10px] font-bold ${needleColorClass}`}>KÂBE</span>
              </div>
              <div
                className={`w-0.5 h-16 transition-colors duration-300 ${
                  aligned ? 'bg-success' : 'bg-gold'
                }`}
              />
            </div>
          </div>

          {/* Merkez Nokta */}
          <div
            className={`w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 transition-colors duration-300 ${
              aligned ? 'bg-success' : 'bg-gold'
            }`}
          />
        </div>

        <div className="p-3 rounded-xl bg-gold/10 border border-gold/20 text-xs">
          <div className="text-[11px] text-mist">Kâbe-i Muazzama Açısı</div>
          <div className="font-numbers text-xl font-extrabold text-gold-ink mt-0.5">
            {qiblaFormatted}°
          </div>
          <p className="text-[10px] text-mist mt-1">
            Telefonunuzu düz bir zemin üzerinde tutarak pusula ibresini Kâbe yönüne çeviriniz.
          </p>
        </div>

        {permissionState === 'idle' && (
          <button
            onClick={requestPermission}
            className="w-full min-h-[48px] px-4 rounded-xl bg-gold hover:bg-[#c4983e] text-[#2D2D2D] font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <CompassIcon className="w-4 h-4" />
            <span>Pusulayı Etkinleştir</span>
          </button>
        )}

        {permissionState === 'denied' && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-2 text-left">
            <WarningCircleIcon className="w-4 h-4 text-danger-ink shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] text-danger-ink">
                İzin reddedildi. Tarayıcı ayarlarından hareket sensörü iznini açıp tekrar deneyin.
              </p>
              <button
                onClick={requestPermission}
                className="relative text-[11px] font-semibold text-gold-ink hover:underline cursor-pointer mt-1 before:content-[''] before:absolute before:-inset-4"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        )}

        {permissionState === 'unsupported' && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-2 text-left">
            <WarningCircleIcon className="w-4 h-4 text-danger-ink shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] text-danger-ink">
                Cihazınız pusula sensörünü desteklemiyor, açı bilgisini yukarıdan kullanabilirsiniz.
              </p>
              <button
                onClick={requestPermission}
                className="relative text-[11px] font-semibold text-gold-ink hover:underline cursor-pointer mt-1 before:content-[''] before:absolute before:-inset-4"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        )}

        {aligned && (
          <p className="text-[11px] font-semibold text-success-ink">
            Kıble yönüne hizalandınız
          </p>
        )}
      </div>
    </BottomSheet>
  );
};
