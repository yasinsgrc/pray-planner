package com.vakit.widget

import com.vakit.R

/**
 * Varyant D: yalnızca çember + dakika hassasiyetli sayaç, günlük vakit
 * satırı yok. Chronometer yerine statik TextView kullandığı için metin
 * dakika alarmında MinuteCountdown.minuteText ile BaseVakitWidgetProvider
 * tarafından yazılır.
 */
class VakitRingMinuteWidgetProvider : BaseVakitWidgetProvider() {
    override val layoutRes: Int = R.layout.vakit_ring_widget_minute
    override val hasDailyRow: Boolean = false
    override val usesChronometer: Boolean = false
}
