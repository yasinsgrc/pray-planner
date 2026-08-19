package com.vakit.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Yalnızca ArcRenderer.computeGeometry()'nin açı aritmetiğini test eder.
 * Bitmap'in görsel doğruluğu bu JVM testleriyle DOĞRULANAMAZ — Canvas
 * gerçek bir cihaz veya Robolectric ister; burada hiçbiri yok.
 */
class ArcRendererTest {

    private val boundaries = listOf(0L, 100L, 200L, 300L, 400L, 500L, 600L)

    @Test
    fun progressIsZeroAtDayCycleStartAndNearOneJustBeforeNextImsak() {
        val atStart = ArcRenderer.computeGeometry(boundaries, now = 0L, gapFrac = 0f)!!
        assertEquals(0f, atStart.progress, 0.0001f)

        val justBeforeEnd = ArcRenderer.computeGeometry(boundaries, now = 599L, gapFrac = 0f)!!
        assertTrue(justBeforeEnd.progress > 0.99f)
    }

    @Test
    fun sixSegmentsSweepExactlyThreeHundredSixtyDegreesTotal() {
        val geometry = ArcRenderer.computeGeometry(boundaries, now = 300L, gapFrac = 0f)!!
        assertEquals(6, geometry.segments.size)

        val totalSweep = geometry.segments.sumOf { seg -> ((seg.trueEnd - seg.trueStart) * 360f).toDouble() }
        assertEquals(360.0, totalSweep, 0.001)
    }

    @Test
    fun midnightToImsakGapResolvesWithinYesterdaysCycle() {
        val msPerHour = 3_600_000L
        val yesterdayImsak = 0L
        val yesterdayGunes = yesterdayImsak + 1 * msPerHour
        val yesterdayOgle = yesterdayImsak + 8 * msPerHour
        val yesterdayIkindi = yesterdayImsak + 11 * msPerHour
        val yesterdayAksam = yesterdayImsak + 14 * msPerHour
        val yesterdayYatsi = yesterdayImsak + 16 * msPerHour
        val todayImsak = yesterdayImsak + 24 * msPerHour
        val dayCycle = listOf(
            yesterdayImsak, yesterdayGunes, yesterdayOgle, yesterdayIkindi,
            yesterdayAksam, yesterdayYatsi, todayImsak
        )

        // Gece yarısı ile bugünün imsakı arasında bir an — dünkü Yatsı-İmsak segmentine düşmeli.
        val midnightToImsakGap = yesterdayImsak + 19 * msPerHour
        val geometry = ArcRenderer.computeGeometry(dayCycle, now = midnightToImsakGap, gapFrac = 0f)!!

        val yatsiSegment = geometry.segments[5]
        assertTrue(geometry.progress > yatsiSegment.trueStart)
        assertTrue(geometry.progress < 1f)
        assertTrue(yatsiSegment.hasElapsed)
    }

    @Test
    fun ringMetricsKeepMarkerOutlineInsideBitmapBounds() {
        listOf(96, 160, 240, 384).forEach { sizePx ->
            val metrics = ArcRenderer.ringMetricsFor(sizePx)!!
            assertTrue(
                "sizePx=$sizePx: marker dış kenarı bitmap dışına taşıyor",
                metrics.radiusPx + metrics.markerRadiusPx + 1f <= sizePx / 2f
            )
        }
    }

    @Test
    fun ringMetricsForReturnsNullForTooSmallSize() {
        assertEquals(null, ArcRenderer.ringMetricsFor(8))
    }
}
