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
        assertEquals(15f, sizes.countdownSp, 0.01f)
    }

    @Test
    fun arcTextSizesClampToFloorWhenCircleIsSmall() {
        val sizes = arcTextSizesFor(60f)
        assertEquals(12f, sizes.countdownSp, 0.01f)
        assertEquals(7f, sizes.locationSp, 0.01f)
        assertEquals(7f, sizes.prayerNameSp, 0.01f)
    }

    @Test
    fun arcTextSizesNeverGoBelowFloorForTinyCircles() {
        val sizes = arcTextSizesFor(1f)
        assert(sizes.countdownSp >= 12f)
        assert(sizes.locationSp >= 7f)
        assert(sizes.prayerNameSp >= 7f)
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
    fun planNextRefreshSwitchesFormatWhenBoundaryIsMoreThanOneHourAway() {
        val now = 0L
        val nextBoundaryMs = 3 * ONE_HOUR_MS
        val plan = planNextRefresh(nextBoundaryMs, now, exactAlarms = false)
        assertEquals(RefreshKind.FORMAT_SWITCH, plan.kind)
        assertEquals(nextBoundaryMs - ONE_HOUR_MS, plan.atMs)
    }

    @Test
    fun planNextRefreshFreezesAtOneMinuteWhenNoExactAlarms() {
        val now = 0L
        val nextBoundaryMs = 40 * 60_000L
        val plan = planNextRefresh(nextBoundaryMs, now, exactAlarms = false)
        assertEquals(RefreshKind.FREEZE, plan.kind)
        assertEquals(nextBoundaryMs - ONE_MINUTE_MS, plan.atMs)
    }

    @Test
    fun planNextRefreshGoesStraightToBoundaryWhenExactAlarmsAvailable() {
        val now = 0L
        val nextBoundaryMs = 40 * 60_000L
        val plan = planNextRefresh(nextBoundaryMs, now, exactAlarms = true)
        assertEquals(RefreshKind.BOUNDARY, plan.kind)
        assertEquals(nextBoundaryMs + BOUNDARY_ALARM_LEAD_MS, plan.atMs)
    }

    @Test
    fun planNextRefreshUsesBoundaryWhenVeryCloseRegardlessOfExactAlarms() {
        val now = 0L
        val nextBoundaryMs = 30_000L
        val withoutExact = planNextRefresh(nextBoundaryMs, now, exactAlarms = false)
        val withExact = planNextRefresh(nextBoundaryMs, now, exactAlarms = true)
        assertEquals(RefreshKind.BOUNDARY, withoutExact.kind)
        assertEquals(RefreshKind.BOUNDARY, withExact.kind)
    }

    @Test
    fun countdownRenderKeepsTickingUnderOneHourWithExactAlarms() {
        val remainingMs = 8 * 60_000L + 37_000L // 8dk 37sn
        val render = countdownRenderFor(remainingMs, exactAlarms = true)
        assertEquals(false, render.frozen)
        assertEquals("00:%s", render.format)
    }

    @Test
    fun countdownRenderFreezesInLastMinuteWithoutExactAlarms() {
        val render = countdownRenderFor(40_000L, exactAlarms = false)
        assertEquals(true, render.frozen)
    }

    @Test
    fun countdownRenderKeepsTickingInLastMinuteWithExactAlarms() {
        val render = countdownRenderFor(40_000L, exactAlarms = true)
        assertEquals(false, render.frozen)
        assertEquals("00:%s", render.format)
    }

    @Test
    fun countdownRenderUsesPlainFormatAtExactlyOneHour() {
        val render = countdownRenderFor(ONE_HOUR_MS, exactAlarms = false)
        assertEquals("%s", render.format)
    }

    @Test
    fun countdownRenderFreezesAtZeroOrNegativeRegardlessOfExactAlarms() {
        assertEquals(true, countdownRenderFor(0L, exactAlarms = false).frozen)
        assertEquals(true, countdownRenderFor(0L, exactAlarms = true).frozen)
        assertEquals(true, countdownRenderFor(-100L, exactAlarms = false).frozen)
        assertEquals(true, countdownRenderFor(-100L, exactAlarms = true).frozen)
    }
}
