import { DayPrayerSchedule } from './prayerCalculator';
import { KerahetInfo } from '../types';
import { getNextReligiousDay } from './religiousDaysSchedule';

const RELIGIOUS_DAY_HORIZON_DAYS = 7;

export type HomeContextSlot =
  | { kind: 'kerahet'; kerahetType: KerahetInfo['type']; remainingSeconds: number }
  | { kind: 'religiousDay'; name: string; daysUntil: number }
  | null;

/**
 * Ana ekranda tek, bağlamsal bir bilgi alanı için öncelik sırası: şu an
 * kerahet içindeysek onu göster (fıkhen daha acil), değilse ve 7 gün
 * içinde bir dinî gün varsa onu göster, aksi halde hiçbir şey — sabit bir
 * kart eklemek (design-refresh-v3 Faz 22 Commit 1'de kaldırılan tekrarları
 * başka biçimde geri getirir.
 */
export function resolveHomeContextSlot(schedule: DayPrayerSchedule, now: Date): HomeContextSlot {
  if (schedule.currentKerahet) {
    const remainingSeconds = Math.max(
      0,
      Math.round((schedule.currentKerahet.endTime.getTime() - now.getTime()) / 1000)
    );
    return { kind: 'kerahet', kerahetType: schedule.currentKerahet.type, remainingSeconds };
  }

  const next = getNextReligiousDay(now, schedule.resolvedTimeZone);
  if (next && next.daysRemaining <= RELIGIOUS_DAY_HORIZON_DAYS) {
    return { kind: 'religiousDay', name: next.entry.name, daysUntil: next.daysRemaining };
  }

  return null;
}
