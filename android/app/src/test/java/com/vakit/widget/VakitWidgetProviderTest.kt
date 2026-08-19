package com.vakit.widget

import org.junit.Assert.assertEquals
import org.junit.Test

class VakitWidgetProviderTest {

    @Test
    fun highlightsNextIndexWhenWithinTodayBlock() {
        assertEquals(3, selectHighlightIndex(activeIndex = 2, nextIndex = 3, dayBlockStart = 0, dayBlockEnd = 6))
    }

    @Test
    fun highlightsActiveIndexWhenNextRollsIntoTomorrow() {
        // Yatsı aktifken (index 5), sıradaki vakit yarının İmsak'ı (index 6) —
        // bugünün bloğu (0..5) dışında. Satır tamamen sönük kalmak yerine
        // Yatsı vurgulanmalı.
        assertEquals(5, selectHighlightIndex(activeIndex = 5, nextIndex = 6, dayBlockStart = 0, dayBlockEnd = 6))
    }

    @Test
    fun highlightsNextIndexInSecondDayBlock() {
        assertEquals(7, selectHighlightIndex(activeIndex = 6, nextIndex = 7, dayBlockStart = 6, dayBlockEnd = 12))
    }

    @Test
    fun arcTextSizesScaleWithCircleDiameter() {
        val sizes = arcTextSizesFor(120f)
        assertEquals(18f, sizes.countdownSp, 0.01f)
    }

    @Test
    fun arcTextSizesClampToFloorWhenCircleIsSmall() {
        val sizes = arcTextSizesFor(60f)
        assertEquals(14f, sizes.countdownSp, 0.01f)
        assertEquals(8f, sizes.locationSp, 0.01f)
        assertEquals(8f, sizes.prayerNameSp, 0.01f)
    }

    @Test
    fun arcTextSizesNeverGoBelowFloorForTinyCircles() {
        val sizes = arcTextSizesFor(1f)
        assert(sizes.countdownSp >= 14f)
        assert(sizes.locationSp >= 8f)
        assert(sizes.prayerNameSp >= 8f)
    }

    @Test
    fun dailyRowTextSizesClampToCeilingOnWideWidget() {
        val sizes = dailyRowTextSizesFor(500f)
        assertEquals(15f, sizes.prayerTimeSp, 0.01f)
        assertEquals(12f, sizes.prayerNameSp, 0.01f)
    }

    @Test
    fun dailyRowTextSizesClampToFloorOnNarrowWidget() {
        val sizes = dailyRowTextSizesFor(200f)
        assertEquals(11f, sizes.prayerTimeSp, 0.01f)
        assertEquals(9f, sizes.prayerNameSp, 0.01f)
    }

    @Test
    fun countdownFormatUsesMmSsPrefixUnderOneHour() {
        val remainingMs = 8 * 60_000L + 37_000L // 8dk 37sn
        assertEquals("00:%s", countdownFormatFor(remainingMs))
    }

    @Test
    fun countdownFormatUsesMmSsPrefixJustUnderOneHourBoundary() {
        val remainingMs = 59 * 60_000L + 59_999L // 59:59.999
        assertEquals("00:%s", countdownFormatFor(remainingMs))
    }

    @Test
    fun countdownFormatSwitchesToPlainFormatAtExactlyOneHour() {
        assertEquals("%s", countdownFormatFor(ONE_HOUR_MS))
    }

    @Test
    fun countdownFormatUsesPlainFormatOverOneHour() {
        val remainingMs = 6 * ONE_HOUR_MS + 5 * 60_000L // 6sa 05dk
        assertEquals("%s", countdownFormatFor(remainingMs))
    }

    @Test
    fun countdownFormatUsesPlainFormatWhenTimeHasPassed() {
        assertEquals("%s", countdownFormatFor(-100L))
    }

    @Test
    fun nextRefreshAtMsWakesEarlyWhenBoundaryIsMoreThanOneHourAway() {
        val nextBoundaryMs = 10_000_000L
        val now = 0L
        assertEquals(nextBoundaryMs - ONE_HOUR_MS, nextRefreshAtMs(nextBoundaryMs, now))
    }

    @Test
    fun nextRefreshAtMsUsesBoundaryDirectlyWhenWithinOneHour() {
        val nextBoundaryMs = 3_000_000L
        val now = 0L
        assertEquals(nextBoundaryMs, nextRefreshAtMs(nextBoundaryMs, now))
    }

    @Test
    fun nextRefreshAtMsUsesBoundaryDirectlyAtExactOneHourEdge() {
        val nextBoundaryMs = ONE_HOUR_MS
        val now = 0L
        assertEquals(nextBoundaryMs, nextRefreshAtMs(nextBoundaryMs, now))
    }
}
