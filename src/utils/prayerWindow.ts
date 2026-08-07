import { DayPrayerSchedule } from './prayerCalculator';

export interface PrayerWindow {
  /** İçinde bulunulan vaktin başlangıcı (epoch ms). */
  startMs: number;
  /** Pencerenin bittiği an = bir sonraki vaktin girdiği an (epoch ms). */
  endMs: number;
  /** Pencerenin toplam uzunluğu (saniye). */
  totalSeconds: number;
  /** Geçen süre (saniye), 0..totalSeconds aralığına kırpılır. */
  elapsedSeconds: number;
  /** 0..1 arası, ekranda çubuk doluluğu olarak kullanılır. Sınırlarda kırpılır. */
  elapsedRatio: number;
}

/**
 * `schedule` ve `now` bilerek ayrı parametreler: `dayCyclePrayers` ve
 * `dayCycleEnd` bir günün sabit gerçekleridir (schedule hangi tick'te
 * türetilmiş olursa olsun aynı kalır), bu yüzden çağıran taraf `now`'ı
 * schedule'ın türetildiği andan bağımsız olarak ilerletebilir — ör. sınır
 * testleri, pencere kapandıktan sonraki bir anı sorgulayabilir.
 */
export function computePrayerWindow(schedule: DayPrayerSchedule, now: Date): PrayerWindow {
  const { dayCyclePrayers, dayCycleEnd, activePrayer } = schedule;
  const idx = dayCyclePrayers.findIndex((p) => p.name === activePrayer.name);

  const startMs = dayCyclePrayers[idx].dateObj.getTime();
  const endMs =
    idx + 1 < dayCyclePrayers.length ? dayCyclePrayers[idx + 1].dateObj.getTime() : dayCycleEnd.getTime();

  const durationMs = endMs - startMs;
  const elapsedMs = Math.min(Math.max(now.getTime() - startMs, 0), durationMs);

  return {
    startMs,
    endMs,
    totalSeconds: Math.round(durationMs / 1000),
    elapsedSeconds: Math.round(elapsedMs / 1000),
    elapsedRatio: durationMs > 0 ? elapsedMs / durationMs : 0,
  };
}
