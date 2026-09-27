package com.vakit

import android.util.Log
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Sistem yazı boyutunu WebView textZoom'u yerine CSS'e taşır. textZoom
 * yalnızca metnin font boyutunu büyütür, rem/em kutuları büyütmez — düzen
 * metinle birlikte ölçeklenmez ve taşar. Bunun yerine textZoom 100'e
 * sabitlenir, fontScale --os-font-scale olarak html'e yazılır ve index.css
 * --ui-scale (1..1.3) ile rem'i ölçekler.
 *
 * load(), Bridge'de registerAllPlugins() içinde loadWebView()'dan ÖNCE
 * çağrılır; document-start script ilk sayfa yüklemesine de yetişir.
 * fontScale değişince activity yeniden oluşur (configChanges'te fontScale
 * yok), dolayısıyla değer her zaman günceldir.
 */
@CapacitorPlugin(name = "FontScale")
class FontScalePlugin : Plugin() {
    override fun load() {
        bridge.webView.settings.textZoom = 100
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            val script = "document.documentElement.style.setProperty('--os-font-scale', '${fontScale()}');"
            WebViewCompat.addDocumentStartJavaScript(bridge.webView, script, setOf("*"))
            Log.i(TAG, "DOCUMENT_START_SCRIPT destekleniyor: document-start yolu, fontScale=${fontScale()}")
        } else {
            // Web tarafı (osFontScale.ts) render öncesi getFontScale() çağırır.
            Log.i(TAG, "DOCUMENT_START_SCRIPT desteklenmiyor: getFontScale() yedeği kullanılacak")
        }
    }

    @PluginMethod
    fun getFontScale(call: PluginCall) {
        Log.i(TAG, "getFontScale() yedeği çağrıldı: fontScale=${fontScale()}")
        call.resolve(JSObject().put("fontScale", fontScaleForJs(fontScale())))
    }

    private companion object {
        const val TAG = "FontScale"
    }

    private fun fontScale(): Float = activity.resources.configuration.fontScale
}

// Float.toDouble() ikili gösterimi genişletir (1.3f → 1.2999999523162842);
// document-start yolunun yazdığı "${fontScale}" ile aynı ondalık değer için
// Float'ın kısa ondalık gösterimi üzerinden çevrilir.
internal fun fontScaleForJs(scale: Float): Double = scale.toString().toDouble()
