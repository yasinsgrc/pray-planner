package com.vakit.widget

import com.vakit.R

/**
 * Varyant B: çember + günlük vakit satırı + dakika hassasiyetli sayaç.
 * Chronometer yerine statik TextView kullandığı için metin dakika alarmında
 * MinuteCountdown.minuteText ile BaseVakitWidgetProvider tarafından yazılır.
 */
class VakitWidgetMinuteProvider : BaseVakitWidgetProvider() {
    override val layoutRes: Int = R.layout.vakit_widget_minute
    override val hasDailyRow: Boolean = true
    override val usesChronometer: Boolean = false
}
