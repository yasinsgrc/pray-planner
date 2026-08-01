import React from 'react';
import { motion } from 'motion/react';
import { CompassIcon, HandHeartIcon, SparkleIcon } from '@phosphor-icons/react';
import { DailyInspirationCard } from './DailyInspirationCard';
import { LocationItem } from '../types';
import { calculateQiblaBearing } from '../utils/qibla';
import { PRESET_DHIKRS, ZikirmatikState } from '../utils/zikirmatikStorage';
import { ESMA_UL_HUSNA } from '../data/esmaulHusna';

interface SpiritualHubProps {
  location: LocationItem;
  zikirState: ZikirmatikState;
  onOpenQiblaModal: () => void;
  onOpenZikirmatikModal: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export const SpiritualHub: React.FC<SpiritualHubProps> = ({
  location,
  zikirState,
  onOpenQiblaModal,
  onOpenZikirmatikModal,
}) => {
  const qiblaBearing = Math.round(calculateQiblaBearing(location));
  const lastDhikr = PRESET_DHIKRS[zikirState.selectedDhikrIndex];

  const todayEsmaIndex = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  ) % ESMA_UL_HUSNA.length;
  const todayEsma = ESMA_UL_HUSNA[todayEsmaIndex];

  return (
    <div className="flex-1 flex flex-col">
      <DailyInspirationCard />

      <div className="w-full max-w-[var(--shell-w)] mx-auto px-4 grid grid-cols-3 gap-3">
        {/* Kıble Kartı (geniş) */}
        <motion.button
          onClick={onOpenQiblaModal}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5, ease: EASE }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="col-span-2 p-4 rounded-2xl bg-card border border-hairline text-left hover:border-gold/40 transition-colors cursor-pointer flex items-center justify-between gap-3"
        >
          <div>
            <div className="text-label text-gold font-bold">Pusula</div>
            <div className="text-base font-bold text-ink mt-1">Kıble Açısı</div>
            <div className="font-numbers text-2xl font-extrabold text-gold mt-1">{qiblaBearing}°</div>
          </div>
          <div className="relative w-14 h-14 rounded-full border-2 border-gold/30 flex items-center justify-center shrink-0">
            <div
              className="absolute inset-0 flex items-start justify-center pt-1"
              style={{ transform: `rotate(${qiblaBearing}deg)` }}
            >
              <div className="w-1 h-4 rounded-full bg-gold" />
            </div>
            <CompassIcon className="w-5 h-5 text-gold/50" />
          </div>
        </motion.button>

        {/* Zikirmatik Kartı (dar) */}
        <motion.button
          onClick={onOpenZikirmatikModal}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="col-span-1 p-4 rounded-2xl bg-card border border-hairline text-left hover:border-gold/40 transition-colors cursor-pointer flex flex-col justify-between"
        >
          <HandHeartIcon className="w-5 h-5 text-gold" />
          <div className="mt-2">
            <div className="text-[11px] text-mist leading-tight">{lastDhikr.title}</div>
            <div className="font-numbers text-sm font-bold text-ink">
              {zikirState.counter}/{lastDhikr.target}
            </div>
          </div>
        </motion.button>
      </div>

      {/* Günün Esmâsı */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.5, ease: EASE }}
        className="w-full max-w-[var(--shell-w)] mx-auto px-4 mt-3 pb-4"
      >
        <div className="p-5 rounded-2xl bg-gold/10 border border-gold/20 text-center">
          <div className="flex items-center justify-center gap-1.5 text-label text-gold font-bold">
            <SparkleIcon className="w-3.5 h-3.5" />
            <span>Günün Esmâsı</span>
          </div>
          <div className="text-2xl font-serif-title font-bold text-ink mt-2">{todayEsma.arabic}</div>
          <div className="text-sm font-semibold text-gold mt-1">{todayEsma.transliteration}</div>
          <p className="text-xs text-mist mt-1.5 leading-relaxed">{todayEsma.meaning}</p>
        </div>
      </motion.div>
    </div>
  );
};
