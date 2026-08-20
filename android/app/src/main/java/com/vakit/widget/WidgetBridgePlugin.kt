package com.vakit.widget

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Tek amaçlı köprü: JS tarafı yeni widget yükünü SharedPreferences'a
 * yazdıktan hemen sonra widget'ı anında yeniden çizdirir — aksi halde
 * yeni veri ancak bir sonraki vakit sınırı alarmına kadar (saatler sürebilir)
 * ekranda görünmez (design-refresh-v3 Faz 23 Commit 4). Ayrı bir npm paketi
 * değil, yalnızca bu uygulamaya özel, app-local bir Capacitor eklentisi.
 */
@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {
    @PluginMethod
    fun refresh(call: PluginCall) {
        BaseVakitWidgetProvider.updateAllWidgets(context)
        call.resolve()
    }
}
