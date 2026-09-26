package com.vakit

import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import androidx.core.view.WindowCompat
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * WebView'in tema kararını status/navigation bar ikon rengine ve pencere
 * zeminine uygular — hidrasyon sonrası tema artık yalnızca web katmanında
 * biliniyor, sistem uiMode'u (gece/gündüz) ile eşleşmeyebilir. Ayrı bir npm
 * paketi değil, yalnızca bu uygulamaya özel, app-local bir Capacitor eklentisi.
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
        val backgroundColor = call.getString("backgroundColor")
        if (backgroundColor == null || !HEX_RGB.matches(backgroundColor)) {
            call.reject("backgroundColor must be #RRGGBB")
            return
        }
        val color = Color.parseColor(backgroundColor)

        activity.runOnUiThread {
            // safe-area eklentisi Chromium < 140'ta inset'i WebView'e native
            // padding olarak veriyor; o şeridi CSS boyayamaz, arkasındaki
            // WebView/pencere zemini görünür. Üçü de temaya boyanmalı.
            activity.window.decorView.setBackgroundColor(color)
            activity.window.setBackgroundDrawable(ColorDrawable(color))
            bridge.webView.setBackgroundColor(color)

            // Ters mantık: isAppearanceLightStatusBars=true "açık zemin,
            // koyu ikon" demek; lightStatusBarIcons=true ise "ikonlar beyaz
            // olsun" demek. Bu yüzden değerin değili atanıyor.
            val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            controller.isAppearanceLightStatusBars = !lightStatusBarIcons
            controller.isAppearanceLightNavigationBars = !lightStatusBarIcons
        }

        call.resolve()
    }

    private companion object {
        val HEX_RGB = Regex("^#[0-9A-Fa-f]{6}$")
    }
}
