import React from 'react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { resolveHomeContextSlot } from '../utils/homeContextSlot';
import { KERAHET_SHORT_LABEL, KERAHET_WINDOW_TITLE, KERAHET_WINDOW_DESCRIPTION } from '../data/strings';

interface HomeContextSlotProps {
  schedule: DayPrayerSchedule;
  now: Date;
  onOpenKerahetInfo: () => void;
}

/**
 * Ana ekranda tek, bağlamsal bir bilgi alanı — sabit bir kart eklemek
 * yerine, o an söylenecek gerçekten bir şey varsa görünür, yoksa hiç yer
 * kaplamaz (design-refresh-v3 Faz 22 Commit 3). Öncelik sırası
 * resolveHomeContextSlot'ta.
 */
export const HomeContextSlot: React.FC<HomeContextSlotProps> = ({ schedule, now, onOpenKerahetInfo }) => {
  const slot = resolveHomeContextSlot(schedule, now);
  if (!slot) return null;

  if (slot.kind === 'kerahet') {
    const remainingMinutes = Math.max(1, Math.ceil(slot.remainingSeconds / 60));
    return (
      <button
        onClick={onOpenKerahetInfo}
        className="w-full mt-3 p-3 rounded-xl bg-card border border-hairline text-left cursor-pointer transition-colors hover:border-gold/40 min-h-[44px]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-label font-bold text-ink">{KERAHET_WINDOW_TITLE[slot.kerahetType]}</span>
          <span className="font-numbers text-label text-gold-ink shrink-0">
            {KERAHET_SHORT_LABEL[slot.kerahetType]} · {remainingMinutes} dk kaldı
          </span>
        </div>
        <p className="mt-1 text-micro text-mist leading-relaxed">{KERAHET_WINDOW_DESCRIPTION[slot.kerahetType]}</p>
      </button>
    );
  }

  return (
    <div className="w-full mt-3 p-3 rounded-xl bg-card border border-hairline">
      <span className="text-label font-semibold text-ink">
        {slot.name} · {slot.daysUntil === 0 ? 'Bugün' : `${slot.daysUntil} gün sonra`}
      </span>
    </div>
  );
};
