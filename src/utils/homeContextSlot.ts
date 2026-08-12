import { DayPrayerSchedule } from './prayerCalculator';
import { KerahetInfo } from '../types';
import { getNextReligiousDay } from './religiousDaysSchedule';

const RELIGIOUS_DAY_HORIZON_DAYS = 7;
const UPCOMING_KERAHET_WINDOW_MS = 15 * 60 * 1000;

export type HomeContextSlot =
  | { kind: 'kerahet'; kerahetType: KerahetInfo['type']; remainingSeconds: number; isUpcoming: boolean }
  | { kind: 'religiousDay'; name: string; daysUntil: number }
  | null;

/**
 * Ana ekranda tek, bağlamsal bir bilgi alanı için öncelik sırası
 * (design-refresh-v3 Faz 22 Commit 1'de kaldırılan tekrarları başka
 * biçimde geri getirir, Faz 24 Commit 5'te genişletildi; Faz 25 Commit 2'de
 * "yarınki imsak farkı" kuralı kaldırıldı — sabit bir dua kartı yerine
 * geçti, düşük değerli bir dolgu metniydi):
 * 1. Şu an kerahet içindeysek VEYA 15 dk içinde başlayacaksa (fıkhen en acil).
 * 2. 7 gün içinde bir dinî gün varsa.
 * 3. Hiçbiri yoksa null — bildirim kurulum ipucu (React state'ine bağlı
 *    olduğu için) çağıran component'in kendi sorumluluğu.
 */
export function resolveHomeContextSlot(schedule: DayPrayerSchedule, now: Date): HomeContextSlot {
  if (schedule.currentKerahet) {
    const remainingSeconds = Math.max(
      0,
      Math.round((schedule.currentKerahet.endTime.getTime() - now.getTime()) / 1000)
    );
    return { kind: 'kerahet', kerahetType: schedule.currentKerahet.type, remainingSeconds, isUpcoming: false };
  }

  const upcomingKerahet = (schedule.kerahetTimes ?? []).find((k) => {
    if (k.isActiveNow) return false;
    const msUntilStart = k.startTime.getTime() - now.getTime();
    return msUntilStart > 0 && msUntilStart <= UPCOMING_KERAHET_WINDOW_MS;
  });
  if (upcomingKerahet) {
    const remainingSeconds = Math.round((upcomingKerahet.startTime.getTime() - now.getTime()) / 1000);
    return { kind: 'kerahet', kerahetType: upcomingKerahet.type, remainingSeconds, isUpcoming: true };
  }

  const next = getNextReligiousDay(now, schedule.resolvedTimeZone);
  if (next && next.daysRemaining <= RELIGIOUS_DAY_HORIZON_DAYS) {
    return { kind: 'religiousDay', name: next.entry.name, daysUntil: next.daysRemaining };
  }

  return null;
}
