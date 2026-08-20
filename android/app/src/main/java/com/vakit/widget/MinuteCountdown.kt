package com.vakit.widget

/**
 * TextView tabanlı (Chronometer olmayan) varyantların dakika hassasiyetli
 * geri sayım metnini üretir. Saf fonksiyonlar — android importu yok, JVM'de
 * test edilir.
 */
object MinuteCountdown {

    /**
     * Kalan süreyi dakikaya AŞAĞI yuvarlar (43dk 38sn -> "43 dk"): kalan
     * süreyi olduğundan az göstermek namaz için güvenli tarafta kalmaktır.
     */
    fun minuteText(remainingMs: Long): String {
        if (remainingMs <= 0L) return "—"
        if (remainingMs < ONE_MINUTE_MS) return "1 dk'dan az"

        val totalMinutes = remainingMs / ONE_MINUTE_MS
        if (totalMinutes < 60) return "$totalMinutes dk"

        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        return "$hours sa $minutes dk"
    }

    /** Bir sonraki dakika sınırına kalan süre; kayma birikmesin diye tam dakikada 60000 döner. */
    fun nextTickDelayMs(remainingMs: Long): Long {
        val remainder = remainingMs % ONE_MINUTE_MS
        return if (remainder == 0L) ONE_MINUTE_MS else remainder
    }
}
