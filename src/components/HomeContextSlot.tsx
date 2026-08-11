import React from 'react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { resolveHomeContextSlot } from '../utils/homeContextSlot';
import { KERAHET_SHORT_LABEL, KERAHET_WINDOW_TITLE, KERAHET_WINDOW_DESCRIPTION } from '../data/strings';
import { PushNotificationHint } from './PushNotificationHint';

interface HomeContextSlotProps {
  schedule: DayPrayerSchedule;
  now: Date;
  onOpenKerahetInfo: () => void;
  /** Rule 4 of the fallback chain — React state (permission/dismissal), so
   * resolveHomeContextSlot (a pure schedule function) can't know it itself. */
  isPushHintVisible: boolean;
  onOpenPushSettings: () => void;
  onDismissPushHint: () => void;
}

/**
 * Ana ekranda tek, bağlamsal bir bilgi alanı — sabit bir kart eklemek
 * yerine, o an söylenecek gerçekten bir şey varsa görünür, yoksa hiç yer
 * kaplamaz (design-refresh-v3 Faz 22 Commit 3). Öncelik sırası
 * resolveHomeContextSlot'ta; 4. sıradaki bildirim ipucu (React state'ine
 * bağlı) burada, Faz 24 Commit 5'te App.tsx'teki üst banttan taşındı —
 * yalnızca gerçekten kullanılmayan bir alanda görünür, her sekmede kalıcı
 * bir bant olarak değil.
 */
export const HomeContextSlot: React.FC<HomeContextSlotProps> = ({
  schedule,
  now,
  onOpenKerahetInfo,
  isPushHintVisible,
  onOpenPushSettings,
  onDismissPushHint,
}) => {
  const slot = resolveHomeContextSlot(schedule, now);

  if (!slot) {
    if (!isPushHintVisible) return null;
    return <PushNotificationHint onOpenSettings={onOpenPushSettings} onDismiss={onDismissPushHint} />;
  }

  if (slot.kind === 'kerahet') {
    const remainingMinutes = Math.max(1, Math.ceil(slot.remainingSeconds / 60));
    return (
      <button
        onClick={onOpenKerahetInfo}
        className="w-full mt-1 p-2.5 rounded-xl bg-card border border-hairline text-left cursor-pointer transition-colors hover:border-gold/40 min-h-[44px]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-label font-bold text-ink">{KERAHET_WINDOW_TITLE[slot.kerahetType]}</span>
          <span className="font-numbers text-label text-gold-ink shrink-0">
            {KERAHET_SHORT_LABEL[slot.kerahetType]} · {remainingMinutes} dk {slot.isUpcoming ? 'sonra başlıyor' : 'kaldı'}
          </span>
        </div>
        <p className="mt-1 text-micro text-mist leading-relaxed">{KERAHET_WINDOW_DESCRIPTION[slot.kerahetType]}</p>
      </button>
    );
  }

  if (slot.kind === 'religiousDay') {
    return (
      <div className="w-full mt-1 p-2.5 rounded-xl bg-card border border-hairline">
        <span className="text-label font-semibold text-ink">
          {slot.name} · {slot.daysUntil === 0 ? 'Bugün' : `${slot.daysUntil} gün sonra`}
        </span>
      </div>
    );
  }

  // slot.kind === 'tomorrowImsakDiff' — hesaplanan bir gerçek, dinî bir
  // iddia değil; ek gerektirecek bir cümle kurmadan sabit üç biçimden biri.
  const abs = Math.abs(slot.diffMinutes);
  const diffLabel =
    slot.diffMinutes === 0 ? 'Yarın imsak bugünle aynı saatte' : slot.diffMinutes < 0 ? `Yarın imsak ${abs} dk erken` : `Yarın imsak ${abs} dk geç`;
  return (
    <div className="w-full mt-1 p-2.5 rounded-xl bg-card border border-hairline">
      <span className="text-label font-semibold text-ink">{diffLabel}</span>
    </div>
  );
};
