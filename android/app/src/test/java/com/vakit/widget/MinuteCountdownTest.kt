package com.vakit.widget

import org.junit.Assert.assertEquals
import org.junit.Test

class MinuteCountdownTest {

    @Test
    fun minuteTextRoundsDownPartialMinute() {
        val remainingMs = 43 * 60_000L + 38_000L // 43dk 38sn
        assertEquals("43 dk", MinuteCountdown.minuteText(remainingMs))
    }

    @Test
    fun minuteTextShowsUnderOneMinuteWhenLessThanSixtySeconds() {
        assertEquals("1 dk'dan az", MinuteCountdown.minuteText(59_000L))
    }

    @Test
    fun minuteTextShowsHoursAndMinutesAtOrOverOneHour() {
        assertEquals("2 sa 15 dk", MinuteCountdown.minuteText(8_100_000L))
    }

    @Test
    fun minuteTextShowsDashAtZero() {
        assertEquals("—", MinuteCountdown.minuteText(0L))
    }

    @Test
    fun minuteTextShowsDashWhenNegative() {
        assertEquals("—", MinuteCountdown.minuteText(-100L))
    }

    @Test
    fun nextTickDelayReturnsRemainderUntilNextMinuteBoundary() {
        val remainingMs = 43 * 60_000L + 38_000L // 43dk 38sn
        assertEquals(38_000L, MinuteCountdown.nextTickDelayMs(remainingMs))
    }

    @Test
    fun nextTickDelayReturnsFullMinuteWhenExactlyOnBoundary() {
        val remainingMs = 44 * 60_000L // tam 44:00
        assertEquals(60_000L, MinuteCountdown.nextTickDelayMs(remainingMs))
    }
}
