package com.vakit.widget

import com.vakit.R

/**
 * Kilit ekranı widget desteği mevcut AppWidget API'sini kullanır (Android
 * 16 QPR2+ saf Android, Samsung One UI, Xiaomi HyperOS) — tek bir widget
 * hem ana ekranda hem kilit ekranında çalışır, ayrı kod yok
 * (design-refresh-v3 Faz 23 Commit 4).
 *
 * adhan Kotlin'e port edilmedi: JS tarafı (widgetBridge.ts) epoch ms
 * yazar, burası yalnızca aritmetik yapar.
 */
class VakitWidgetProvider : BaseVakitWidgetProvider() {
    override val layoutRes: Int = R.layout.vakit_widget
    override val hasDailyRow: Boolean = true
    override val usesChronometer: Boolean = true
}
