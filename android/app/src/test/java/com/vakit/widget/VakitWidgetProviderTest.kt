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
}
