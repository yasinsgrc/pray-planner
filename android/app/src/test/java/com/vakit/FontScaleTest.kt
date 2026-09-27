package com.vakit

import org.junit.Assert.assertEquals
import org.junit.Test

class FontScaleTest {

    // getFontScale() yedeği, document-start yolunun yazdığı "${fontScale}"
    // ile birebir aynı değeri vermeli: Float.toDouble() 1.3f'yi
    // 1.2999999523162842 yapıyordu (emülatörde WebView 134'te görüldü).
    @Test
    fun fontScaleForJsMatchesSystemSettingExactly() {
        assertEquals(1.3, fontScaleForJs(1.3f), 0.0)
        assertEquals(1.15, fontScaleForJs(1.15f), 0.0)
        assertEquals(1.0, fontScaleForJs(1.0f), 0.0)
        assertEquals(2.0, fontScaleForJs(2.0f), 0.0)
    }
}
