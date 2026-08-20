package com.vakit.widget

import com.vakit.R

/**
 * Varyant C: yalnızca çember + saniye hassasiyetli sayaç, günlük vakit
 * satırı yok. Render/alarm/tıklama mantığı BaseVakitWidgetProvider'da yaşar.
 */
class VakitRingWidgetProvider : BaseVakitWidgetProvider() {
    override val layoutRes: Int = R.layout.vakit_ring_widget
    override val hasDailyRow: Boolean = false
    override val usesChronometer: Boolean = true
}
