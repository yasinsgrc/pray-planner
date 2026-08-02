import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowCounterClockwiseIcon } from './icons';
import { playSoftChime } from '../utils/audio';
import { PRESET_DHIKRS, ZikirmatikState } from '../utils/zikirmatikStorage';
import { BottomSheet } from './BottomSheet';

interface ZikirmatikModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: ZikirmatikState;
  onChange: (state: ZikirmatikState) => void;
}

const RING_SIZE = 176;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const ZikirmatikModal: React.FC<ZikirmatikModalProps> = ({
  isOpen,
  onClose,
  state,
  onChange,
}) => {
  const { selectedDhikrIndex, counter, lap } = state;
  const [justCompleted, setJustCompleted] = useState(false);

  const currentDhikr = PRESET_DHIKRS[selectedDhikrIndex];
  const ringProgress = counter / currentDhikr.target;
  const ringDashoffset = RING_CIRCUMFERENCE * (1 - ringProgress);

  const handleIncrement = () => {
    if (navigator.vibrate) {
      navigator.vibrate(25);
    }
    const newCount = counter + 1;
    if (newCount >= currentDhikr.target) {
      playSoftChime();
      onChange({ selectedDhikrIndex, counter: 0, lap: lap + 1 });
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 700);
    } else {
      onChange({ selectedDhikrIndex, counter: newCount, lap });
    }
  };

  const handleReset = () => {
    onChange({ selectedDhikrIndex, counter: 0, lap: 0 });
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Sakin Zikirmatik">
      <div className="text-center space-y-4 pb-2">
        {/* Zikir Seçimi: yatay kaydırma yerine flex-wrap — 5 öğe 390px'te
            iki satıra sarar, hiçbiri gizli/erişilemez kalmaz (design-refresh-v3
            Faz 2 F3: ölçülen 431px içerik 358px kutu içinde taşıyordu, son 2
            zikir hiç görünmüyordu). */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {PRESET_DHIKRS.map((d, idx) => (
            <button
              key={d.title}
              onClick={() => onChange({ selectedDhikrIndex: idx, counter: 0, lap: 0 })}
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
        <div className="py-1">
          <div className="text-xl font-bold font-serif-title text-gold-ink">
            {currentDhikr.arabic}
          </div>
          <div className="text-xs text-mist font-medium mt-1">
            Hedef: {currentDhikr.target} • Tur: {lap}
          </div>
        </div>

        {/* Sayac Butonu / Dokunma Alanı, ilerleme halkalı */}
        <div className="relative w-44 h-44 mx-auto">
          <svg width={RING_SIZE} height={RING_SIZE} className="absolute inset-0 transform -rotate-90">
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="var(--hairline)"
              strokeWidth={RING_STROKE}
              fill="transparent"
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="var(--gold)"
              strokeWidth={RING_STROKE}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-300 ease-out"
            />
          </svg>
          <motion.button
            onClick={handleIncrement}
            aria-label="Zikir say"
            animate={justCompleted ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-2 rounded-full bg-gradient-to-b from-gold to-[#c4983e] text-white shadow-lg active:scale-95 transition-transform flex flex-col items-center justify-center cursor-pointer border-4 border-white dark:border-card"
          >
            <span className="font-numbers text-5xl font-extrabold tracking-tight">
              {counter}
            </span>
            <span className="text-label font-semibold opacity-90 mt-1">
              Çekmek İçin Dokun
            </span>
          </motion.button>
          <AnimatePresence>
            {justCompleted && (
              <motion.div
                initial={{ opacity: 0.6, scale: 1 }}
                animate={{ opacity: 0, scale: 1.3 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full border-4 border-gold pointer-events-none"
              />
            )}
          </AnimatePresence>
        </div>

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
    </BottomSheet>
  );
};
