import { DayPrayerSchedule } from './prayerCalculator';
import { KerahetInfo } from '../types';
import { getNextReligiousDay } from './religiousDaysSchedule';

const RELIGIOUS_DAY_HORIZON_DAYS = 7;
const UPCOMING_KERAHET_WINDOW_MS = 15 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

export type HomeContextSlot =
  | { kind: 'kerahet'; kerahetType: KerahetInfo['type']; remainingSeconds: number; isUpcoming: boolean }
  | { kind: 'religiousDay'; name: string; daysUntil: number }
  /** Negative = tomorrow's imsak is earlier (days lengthening); positive = later. */
  | { kind: 'tomorrowImsakDiff'; diffMinutes: number }
  | null;

/**
 * Ana ekranda tek, bağlamsal bir bilgi alanı için öncelik sırası
 * (design-refresh-v3 Faz 22 Commit 1'de kaldırılan tekrarları başka
 * biçimde geri getirir, Faz 24 Commit 5'te genişletildi):
 * 1. Şu an kerahet içindeysek VEYA 15 dk içinde başlayacaksa (fıkhen en acil).
 * 2. 7 gün içinde bir dinî gün varsa.
 * 3. Aksi halde yarınki imsak vaktinin bugünkinden kaç dakika erken/geç
 *    olduğu — her gün hesaplanan, her zaman mevcut bir gerçek, sabit bir
 *    kart yerine "yer kaplasın diye" uydurulmuş bir metin değil.
 * 4. Hiçbiri yoksa null — bildirim kurulum ipucu (React state'ine bağlı
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

  const todayImsak = schedule.prayers?.find((p) => p.name === 'imsak');
  if (todayImsak && schedule.tomorrowImsakDate) {
    const diffMinutes =
      Math.round((schedule.tomorrowImsakDate.getTime() - todayImsak.dateObj.getTime()) / 60000) -
      MINUTES_PER_DAY;
    return { kind: 'tomorrowImsakDiff', diffMinutes };
  }

  return null;
}
