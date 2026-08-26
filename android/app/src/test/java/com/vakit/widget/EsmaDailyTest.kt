package com.vakit.widget

import org.junit.Assert.assertEquals
import org.junit.Test

class EsmaDailyTest {

    @Test
    fun dayOfYear1Count24ReturnsIndex1() {
        assertEquals(1, esmaIndexFor(1, 24))
    }

    @Test
    fun dayOfYear24Count24WrapsToIndex0() {
        assertEquals(0, esmaIndexFor(24, 24))
    }

    @Test
    fun dayOfYear366Count24ReturnsIndex6() {
        assertEquals(6, esmaIndexFor(366, 24))
    }

    @Test
    fun countZeroReturnsIndex0() {
        assertEquals(0, esmaIndexFor(100, 0))
    }

    @Test
    fun negativeDayOfYearReturnsIndex0() {
        assertEquals(0, esmaIndexFor(-5, 24))
    }
}
