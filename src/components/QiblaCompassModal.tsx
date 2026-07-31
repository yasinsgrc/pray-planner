import React from 'react';
import { Compass, X, MapPin } from 'lucide-react';
import { LocationItem } from '../types';

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
  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-xl p-5 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[#D6A84D]/15 pb-3">
          <div className="flex items-center gap-2 text-left">
            <Compass className="w-5 h-5 text-[#D6A84D]" />
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
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pusula Görsel Alanı */}
        <div className="relative w-52 h-52 mx-auto my-4 flex items-center justify-center rounded-full border-2 border-[#D6A84D]/30 bg-[var(--paper)] shadow-inner">
          {/* Kuzey / Güney / Doğu / Batı İşaretleri */}
          <span className="absolute top-2 text-[10px] font-bold text-red-500">N (Kuzey)</span>
          <span className="absolute bottom-2 text-[10px] font-bold text-[var(--mist)]">S (Güney)</span>
          <span className="absolute right-2 text-[10px] font-bold text-[var(--mist)]">E (Doğu)</span>
          <span className="absolute left-2 text-[10px] font-bold text-[var(--mist)]">W (Batı)</span>

          {/* Dönen Kıble İbresi */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-700 ease-out"
            style={{ transform: `rotate(${qiblaBearing}deg)` }}
          >
            <div className="flex flex-col items-center justify-start h-full py-3">
              {/* Kâbe Simgesi / Altın İbre Başı */}
              <div className="w-7 h-7 rounded-lg bg-[#2D2D2D] border-2 border-[#D6A84D] flex items-center justify-center shadow-md">
                <span className="text-[10px] font-bold text-[#D6A84D]">KÂBE</span>
              </div>
              <div className="w-0.5 h-16 bg-[#D6A84D]" />
            </div>
          </div>

          {/* Merkez Nokta */}
          <div className="w-4 h-4 rounded-full bg-[#D6A84D] border-2 border-white shadow-sm z-10" />
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
      </div>
    </div>
  );
};
