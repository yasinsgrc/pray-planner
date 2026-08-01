import React, { useEffect, useState } from 'react';
import { HandHeartIcon, ArrowCounterClockwiseIcon, XIcon } from '@phosphor-icons/react';
import { playSoftChime } from '../utils/audio';
import { PRESET_DHIKRS, loadZikirmatikState, saveZikirmatikState } from '../utils/zikirmatikStorage';

interface ZikirmatikModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ZikirmatikModal: React.FC<ZikirmatikModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedDhikrIndex, setSelectedDhikrIndex] = useState(() => loadZikirmatikState().selectedDhikrIndex);
  const [counter, setCounter] = useState(() => loadZikirmatikState().counter);
  const [lap, setLap] = useState(() => loadZikirmatikState().lap);

  useEffect(() => {
    saveZikirmatikState({ selectedDhikrIndex, counter, lap });
  }, [selectedDhikrIndex, counter, lap]);

  if (!isOpen) return null;

  const currentDhikr = PRESET_DHIKRS[selectedDhikrIndex];

  const handleIncrement = () => {
    if (navigator.vibrate) {
      navigator.vibrate(25);
    }
    const newCount = counter + 1;
    if (newCount >= currentDhikr.target) {
      playSoftChime();
      setCounter(0);
      setLap((prev) => prev + 1);
    } else {
      setCounter(newCount);
    }
  };

  const handleReset = () => {
    setCounter(0);
    setLap(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-card border border-hairline rounded-2xl shadow-xl p-5 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-gold/15 pb-3">
          <div className="flex items-center gap-2">
            <HandHeartIcon className="w-5 h-5 text-gold" />
            <h3 className="font-serif-title font-bold text-base text-ink">
              Sakin Zikirmatik
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-mist cursor-pointer"
            aria-label="Kapat"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Zikir Seçimi */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {PRESET_DHIKRS.map((d, idx) => (
            <button
              key={d.title}
              onClick={() => {
                setSelectedDhikrIndex(idx);
                setCounter(0);
                setLap(0);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedDhikrIndex === idx
                  ? 'bg-gold text-white shadow-xs'
                  : 'bg-paper text-mist hover:text-ink'
              }`}
            >
              {d.title}
            </button>
          ))}
        </div>

        {/* Zikir Bilgisi */}
        <div className="py-2">
          <div className="text-xl font-bold font-serif-title text-gold">
            {currentDhikr.arabic}
          </div>
          <div className="text-xs text-mist font-medium mt-1">
            Hedef: {currentDhikr.target} • Tur: {lap}
          </div>
        </div>

        {/* Sayac Butonu / Dokunma Alanı */}
        <button
          onClick={handleIncrement}
          aria-label="Zikir say"
          className="w-44 h-44 mx-auto rounded-full bg-gradient-to-b from-gold to-[#c4983e] text-white shadow-lg active:scale-95 transition-transform flex flex-col items-center justify-center cursor-pointer border-4 border-white dark:border-card"
        >
          <span className="font-numbers text-5xl font-extrabold tracking-tight">
            {counter}
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold opacity-90 mt-1">
            Çekmek İçin Dokun
          </span>
        </button>

        {/* Alt Butonlar */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-mist hover:text-red-500 transition-colors cursor-pointer"
          >
            <ArrowCounterClockwiseIcon className="w-3.5 h-3.5" /> Sıfırla
          </button>

          <span className="text-[11px] text-mist">
            {currentDhikr.target - counter} kaldı
          </span>
        </div>
      </div>
    </div>
  );
};
