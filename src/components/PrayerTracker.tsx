import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckIcon } from '@phosphor-icons/react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { PrayerName } from '../types';
import {
  PrayerLog,
  dateKey,
  loadPrayerLog,
  savePrayerLog,
  pruneOldEntries,
  computeWeekCount,
} from '../utils/prayerLogStorage';

interface PrayerTrackerProps {
  schedule: DayPrayerSchedule;
}

// Güneş bir namaz vakti değil, takibe dahil edilmez.
const TRACKED_PRAYERS: PrayerName[] = ['imsak', 'ogle', 'ikindi', 'aksam', 'yatsi'];

/**
 * "Bugünün Namaz Takibi" — a reminder, not a pressure tool (design-refresh-v3
 * F7). No red X, no "missed" language, no streak-broken notification. An
 * unmarked prayer is just an empty circle, nothing more emphasized than
 * that. Future prayers can't be marked at all — only ones whose time has
 * actually arrived.
 */
export const PrayerTracker: React.FC<PrayerTrackerProps> = ({ schedule }) => {
  const [log, setLog] = useState<PrayerLog>(loadPrayerLog);
  const todayKey = dateKey(schedule.date);
  const todayMarked = log[todayKey] ?? [];

  const toggle = (name: PrayerName) => {
    const marked = new Set(todayMarked);
    if (marked.has(name)) {
      marked.delete(name);
    } else {
      marked.add(name);
      if (navigator.vibrate) navigator.vibrate(20);
    }
    const updated = pruneOldEntries({ ...log, [todayKey]: Array.from(marked) });
    setLog(updated);
    savePrayerLog(updated);
  };

  const weekCount = computeWeekCount(log);

  return (
    <div className="p-4 rounded-2xl bg-card border border-hairline">
      <div className="flex items-center justify-between">
        <span className="text-label text-mist font-semibold">Bugün</span>
        <span className="font-numbers text-xs font-bold text-mist">
          {todayMarked.length}/{TRACKED_PRAYERS.length}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5 mt-2.5">
        {TRACKED_PRAYERS.map((name) => {
          const p = schedule.prayers.find((pr) => pr.name === name);
          if (!p) return null;
          const isMarked = todayMarked.includes(name);
          const canMark = p.isPast || p.isActive;

          return (
            <button
              key={name}
              disabled={!canMark}
              onClick={() => toggle(name)}
              aria-label={`${p.label}${isMarked ? ' işaretlendi' : canMark ? ' işaretle' : ' henüz vakit girmedi'}`}
              className={`flex flex-col items-center gap-1.5 py-2 rounded-xl transition-colors ${
                canMark ? 'cursor-pointer hover:bg-paper' : 'cursor-not-allowed'
              }`}
            >
              <motion.div
                animate={isMarked ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-7 h-7 rounded-full border-2 flex items-center justify-center"
                style={{
                  borderColor: isMarked ? 'var(--accent)' : 'var(--hairline)',
                  backgroundColor: isMarked ? 'var(--accent)' : 'transparent',
                  opacity: canMark ? 1 : 0.35,
                }}
              >
                {isMarked && <CheckIcon weight="bold" className="w-3.5 h-3.5 text-white" />}
              </motion.div>
              <span className="text-micro" style={{ color: canMark ? 'var(--ink)' : 'var(--mist)' }}>
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 text-micro text-mist text-center">Bu hafta {weekCount} vakit</p>
    </div>
  );
};
