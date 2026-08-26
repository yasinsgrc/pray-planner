package com.vakit

import androidx.core.view.WindowCompat
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * WebView'in tema kararını status/navigation bar ikon rengine uygular —
 * hidrasyon sonrası tema artık yalnızca web katmanında biliniyor, sistem
 * uiMode'u (gece/gündüz) ile eşleşmeyebilir. Ayrı bir npm paketi değil,
 * yalnızca bu uygulamaya özel, app-local bir Capacitor eklentisi.
 */
@CapacitorPlugin(name = "StatusBarAppearance")
class StatusBarAppearancePlugin : Plugin() {
    @PluginMethod
    fun setAppearance(call: PluginCall) {
        val lightStatusBarIcons = call.getBoolean("lightStatusBarIcons")
        if (lightStatusBarIcons == null) {
            call.reject("lightStatusBarIcons is required")
            return
        }

        activity.runOnUiThread {
            // Ters mantık: isAppearanceLightStatusBars=true "açık zemin,
            // koyu ikon" demek; lightStatusBarIcons=true ise "ikonlar beyaz
            // olsun" demek. Bu yüzden değerin değili atanıyor.
            val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            controller.isAppearanceLightStatusBars = !lightStatusBarIcons
            controller.isAppearanceLightNavigationBars = !lightStatusBarIcons
        }

        call.resolve()
    }
}
