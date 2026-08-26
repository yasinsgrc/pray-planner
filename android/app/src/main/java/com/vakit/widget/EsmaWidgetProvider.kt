package com.vakit.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import com.vakit.MainActivity
import com.vakit.R
import org.json.JSONObject
import java.util.Calendar

/**
 * Vakit / günlük Esmâ-ül Hüsnâ widget'ı. Vakit widget'larından TAMAMEN
 * bağımsız: BaseVakitWidgetProvider'dan TÜREMEZ, kendi alarm zincirini,
 * kendi request code'unu (3) ve kendi güncelleme mantığını taşır.
 * JS tarafı (widgetStorage.ts) günün tüm isim listesini SharedPreferences'a
 * yazar; hangi ismin bugüne denk geldiğini bu sınıf kendisi hesaplar
 * (esmaIndexFor, EsmaDaily.kt) — böylece uygulama hiç açılmasa bile widget
 * her gece yarısı değişir.
 */
class EsmaWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val PREFS_NAME = "CapacitorStorage"
        private const val PAYLOAD_KEY = "vakit_esma_payload_v1"
        private const val SCHEMA_VERSION = 1
        const val ACTION_REFRESH_ESMA = "com.vakit.widget.ACTION_REFRESH_ESMA"
        private const val MIDNIGHT_ALARM_REQUEST_CODE = 3

        /** JS tarafı yeni yük yazdığında (WidgetBridgePlugin.refresh) ve gece yarısı alarmında çağrılır. */
        fun updateAllWidgets(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, EsmaWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val provider = EsmaWidgetProvider()
            for (id in ids) provider.updateWidget(context, manager, id)
            scheduleNextMidnightAlarm(context)
        }

        private fun midnightAlarmPendingIntent(context: Context): PendingIntent {
            val intent = Intent(context, EsmaWidgetProvider::class.java).apply {
                action = ACTION_REFRESH_ESMA
            }
            return PendingIntent.getBroadcast(
                context, MIDNIGHT_ALARM_REQUEST_CODE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        /**
         * Bir sonraki yerel gece yarısına setWindow alarmı (5 dk pencere).
         * Tam alarm KULLANMA — vakit sınırlarının aksine burada dakikalık
         * gecikme zararsız.
         */
        private fun scheduleNextMidnightAlarm(context: Context) {
            val now = Calendar.getInstance()
            val nextMidnight = (now.clone() as Calendar).apply {
                add(Calendar.DAY_OF_YEAR, 1)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val delayMs = nextMidnight.timeInMillis - now.timeInMillis
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val triggerElapsedRealtime = SystemClock.elapsedRealtime() + delayMs
            alarmManager.setWindow(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                triggerElapsedRealtime,
                5 * 60 * 1000L,
                midnightAlarmPendingIntent(context)
            )
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
        scheduleNextMidnightAlarm(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_BOOT_COMPLETED,
            ACTION_REFRESH_ESMA -> updateAllWidgets(context)
        }
    }

    override fun onDisabled(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(midnightAlarmPendingIntent(context))
    }

    private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.esma_widget)

        val openAppIntent = Intent(context, MainActivity::class.java)
        val openAppPendingIntent = PendingIntent.getActivity(
            context, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_root, openAppPendingIntent)

        if (tryRenderContent(context, views)) {
            views.setViewVisibility(R.id.widget_content, View.VISIBLE)
            views.setViewVisibility(R.id.widget_empty, View.GONE)
        } else {
            views.setViewVisibility(R.id.widget_content, View.GONE)
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    /**
     * Yük yoksa / bozuksa / names boşsa false döner ve çağıran taraf boş
     * durumu gösterir. Yanlış bir isim göstermek hiç göstermemekten kötü —
     * vakit widget'ının tryRenderContent'indeki aynı savunmacı ilke.
     */
    private fun tryRenderContent(context: Context, views: RemoteViews): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(PAYLOAD_KEY, null) ?: return false

        val json = try {
            JSONObject(raw)
        } catch (e: Exception) {
            return false
        }

        if (json.optInt("schemaVersion", -1) != SCHEMA_VERSION) return false

        val namesJson = json.optJSONArray("names") ?: return false
        if (namesJson.length() == 0) return false

        val dayOfYear = Calendar.getInstance().get(Calendar.DAY_OF_YEAR)
        val index = esmaIndexFor(dayOfYear, namesJson.length())
        val entry = namesJson.optJSONObject(index) ?: return false

        val arabic = entry.optString("arabic", "")
        val transliteration = entry.optString("transliteration", "")
        val meaning = entry.optString("meaning", "")
        if (arabic.isEmpty() || transliteration.isEmpty() || meaning.isEmpty()) return false

        views.setTextViewText(R.id.widget_esma_arabic, arabic)
        views.setTextViewText(R.id.widget_esma_transliteration, transliteration)
        views.setTextViewText(R.id.widget_esma_meaning, meaning)
        return true
    }
}
