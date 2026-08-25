import React from 'react';
import { DayPrayerSchedule } from '../utils/prayerCalculator';
import { resolveHomeContextSlot } from '../utils/homeContextSlot';
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
    // Kerahet bilgisi artık yalnızca KerahetStrip'te (chip'ler + aktif
    // vaktin açıklaması) gösteriliyor — burada ayrı bir kart tekrar etmiyor.
    return null;
  }

  // slot.kind === 'religiousDay' — kalan tek varyant.
  return (
    <div className="w-full mt-1 p-2.5 rounded-xl bg-card border border-hairline">
      <span className="text-label font-semibold text-ink">
        {slot.name} · {slot.daysUntil === 0 ? 'Bugün' : `${slot.daysUntil} gün sonra`}
      </span>
    </div>
  );
};
