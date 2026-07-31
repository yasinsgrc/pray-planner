import React from 'react';
import { Smartphone, Lock, Clock, X, Check } from 'lucide-react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';

interface LiveActivityWidgetModalProps {
  schedule: DayPrayerSchedule;
  isOpen: boolean;
  onClose: () => void;
}

export const LiveActivityWidgetModal: React.FC<LiveActivityWidgetModalProps> = ({
  schedule,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const {
    activePrayer,
    nextPrayer,
    timeRemainingFormatted,
    ringProgress,
    location,
  } = schedule;

  const size = 52;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - ringProgress);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#121316] text-white border border-gray-800 rounded-3xl shadow-2xl p-5 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[#D6A84D]" />
            <div>
              <h3 className="font-serif-title font-bold text-sm text-white">
                Kilit Ekranı Canlı Etkinliği
              </h3>
              <p className="text-[10px] text-gray-400">
                iOS Live Activity & Android Widget Önizlemesi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-800 text-gray-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Telefon Kilit Ekranı Simülasyonu */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-gray-900 to-black border border-gray-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between text-[11px] text-gray-400 border-b border-gray-800/80 pb-2">
            <div className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#D6A84D]" />
              <span>Kilit Ekranı</span>
            </div>
            <span>{location.districtName}, {location.cityName}</span>
          </div>

          {/* Canlı Widget Kartı */}
          <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-between gap-3 shadow-lg">
            {/* Sol: Küçük Altın Halka */}
            <div className="relative w-13 h-13 flex items-center justify-center shrink-0">
              <svg width={size} height={size} className="transform -rotate-90">
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="#D6A84D"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute font-numbers text-[10px] font-bold text-[#D6A84D]">
                VAKİT
              </div>
            </div>

            {/* Orta: Vakit Bilgisi */}
            <div className="flex-1 text-left">
              <div className="text-[10px] text-gray-300 font-medium">
                {nextPrayer.label} Vaktine Kalan
              </div>
              <div className="font-numbers text-xl font-extrabold text-white tracking-tight">
                {timeRemainingFormatted}
              </div>
              <div className="text-[10px] text-[#D6A84D]">
                Şu an: {activePrayer.label} ({activePrayer.timeString})
              </div>
            </div>

            {/* Sağ: Saat */}
            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-[#D6A84D] font-numbers">
                {nextPrayer.timeString}
              </div>
              <div className="text-[9px] text-gray-400">Sıradaki</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Arka planda ve kilit ekranında altın halka canlı olarak güncellenir.</span>
        </div>
      </div>
    </div>
  );
};
