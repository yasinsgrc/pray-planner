import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowCounterClockwiseIcon, CheckIcon } from './icons';
import { playSoftChime } from '../utils/audio';
import { PRESET_DHIKRS, ZikirmatikState, getCounterFor } from '../utils/zikirmatikStorage';
import { BottomSheet } from './BottomSheet';

interface ZikirmatikModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: ZikirmatikState;
  onChange: (state: ZikirmatikState) => void;
  /** Called once per tap (not just on lap completion) so the caller can add it to the daily total (design-refresh-v3 Faz 7 F3). */
  onDhikrTap: (dhikrTitle: string) => void;
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
  onDhikrTap,
}) => {
  const { selectedDhikrIndex } = state;
  const { counter, lap } = getCounterFor(state, selectedDhikrIndex);
  const [justCompleted, setJustCompleted] = useState(false);
  // Sıfırla iki adımlı onay ister (design-refresh-v3 Faz 7 F3) — bir tur
  // ilerlemeyi tek dokunuşla kaybetmek, sayacın "sakin" karakteriyle
  // çelişir. Zikir değiştirince veya sheet kapanınca otomatik iptal olur.
  const [confirmingReset, setConfirmingReset] = useState(false);

  const currentDhikr = PRESET_DHIKRS[selectedDhikrIndex];
  const ringProgress = counter / currentDhikr.target;
  const ringDashoffset = RING_CIRCUMFERENCE * (1 - ringProgress);

  const selectDhikr = (idx: number) => {
    setConfirmingReset(false);
    onChange({ ...state, selectedDhikrIndex: idx });
  };

  const handleIncrement = () => {
    if (navigator.vibrate) {
      navigator.vibrate(25);
    }
    onDhikrTap(currentDhikr.title);
    const newCount = counter + 1;
    if (newCount >= currentDhikr.target) {
      playSoftChime();
      onChange({
        ...state,
        counters: { ...state.counters, [selectedDhikrIndex]: { counter: 0, lap: lap + 1 } },
      });
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 700);
    } else {
      onChange({
        ...state,
        counters: { ...state.counters, [selectedDhikrIndex]: { counter: newCount, lap } },
      });
    }
  };

  const handleResetClick = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    onChange({ ...state, counters: { ...state.counters, [selectedDhikrIndex]: { counter: 0, lap: 0 } } });
    setConfirmingReset(false);
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
              onClick={() => selectDhikr(idx)}
              className={`px-3 py-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedDhikrIndex === idx
                  ? 'bg-gold text-on-gold shadow-xs'
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
            className="absolute inset-2 rounded-full bg-gradient-to-b from-gold to-gold-hover text-on-gold shadow-lg active:scale-95 transition-transform flex flex-col items-center justify-center cursor-pointer border-4 border-white dark:border-card"
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
          {confirmingReset ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetClick}
                className="relative flex items-center gap-1 text-xs font-semibold text-danger-ink cursor-pointer before:content-[''] before:absolute before:-inset-3"
              >
                <CheckIcon className="w-3.5 h-3.5" /> Emin misiniz?
              </button>
              <button
                onClick={() => setConfirmingReset(false)}
                className="relative text-xs text-mist cursor-pointer before:content-[''] before:absolute before:-inset-3"
              >
                Vazgeç
              </button>
            </div>
          ) : (
            <button
              onClick={handleResetClick}
              className="relative flex items-center gap-1 text-xs text-mist hover:text-danger-ink transition-colors cursor-pointer before:content-[''] before:absolute before:-inset-4"
            >
              <ArrowCounterClockwiseIcon className="w-3.5 h-3.5" /> Sıfırla
            </button>
          )}

          <span className="text-[11px] text-mist">
            {currentDhikr.target - counter} kaldı
          </span>
        </div>
      </div>
    </BottomSheet>
  );
};
