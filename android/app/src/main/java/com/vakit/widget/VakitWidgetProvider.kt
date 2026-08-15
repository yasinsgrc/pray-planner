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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Kilit ekranı widget desteği mevcut AppWidget API'sini kullanır (Android
 * 16 QPR2+ saf Android, Samsung One UI, Xiaomi HyperOS) — tek bir widget
 * hem ana ekranda hem kilit ekranında çalışır, ayrı kod yok
 * (design-refresh-v3 Faz 23 Commit 4).
 *
 * adhan Kotlin'e port edilmedi: JS tarafı (widgetBridge.ts) epoch ms
 * yazar, burası yalnızca aritmetik yapar.
 */
/**
 * Bugünün 6'lı vakit bloğunda (dayBlockStart..dayBlockEnd) hangi slotun
 * vurgulanacağını seçer. dayBlockStart her zaman activeIndex'ten türetildiği
 * için activeIndex bu aralığın içindedir — bu yüzden fonksiyon hiçbir zaman
 * -1 döndürmez. Yatsı aktifken sıradaki vakit (nextIndex) yarının İmsak'ı
 * olup bugünün bloğu dışına taşarsa, satırın tamamen sönük kalması yerine
 * Yatsı'nın kendisi vurgulanır.
 */
internal fun selectHighlightIndex(activeIndex: Int, nextIndex: Int, dayBlockStart: Int, dayBlockEnd: Int): Int {
    val nextWithinToday = if (nextIndex in dayBlockStart until dayBlockEnd) nextIndex else -1
    return if (nextWithinToday != -1) nextWithinToday else activeIndex
}

class VakitWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val PREFS_NAME = "CapacitorStorage"
        private const val PAYLOAD_KEY = "vakit_widget_payload_v1"
        private const val SCHEMA_VERSION = 1
        const val ACTION_REFRESH_BOUNDARY = "com.vakit.widget.ACTION_REFRESH_BOUNDARY"

        /** JS tarafı yeni yük yazdığında (WidgetBridgePlugin.refresh) ve dahili sınır alarmlarında çağrılır. */
        fun updateAllWidgets(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, VakitWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val provider = VakitWidgetProvider()
            for (id in ids) provider.updateWidget(context, manager, id)
            provider.scheduleNextBoundaryAlarm(context)
        }

        private fun boundaryAlarmPendingIntent(context: Context): PendingIntent {
            val intent = Intent(context, VakitWidgetProvider::class.java).apply {
                action = ACTION_REFRESH_BOUNDARY
            }
            return PendingIntent.getBroadcast(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }

    private data class WidgetEntry(val name: String, val label: String, val atMs: Long)

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
        scheduleNextBoundaryAlarm(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_BOOT_COMPLETED,
            ACTION_REFRESH_BOUNDARY -> updateAllWidgets(context)
        }
    }

    override fun onDisabled(context: Context) {
        // Son widget örneği kaldırıldığında sınır alarmını da iptal et —
        // aksi halde sahipsiz bir alarm gereksiz yere ateşlenmeye devam eder.
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(boundaryAlarmPendingIntent(context))
    }

    private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.vakit_widget)

        val openAppIntent = Intent(context, MainActivity::class.java)
        val openAppPendingIntent = PendingIntent.getActivity(
            context, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_root, openAppPendingIntent)

        val now = System.currentTimeMillis()
        val rendered = tryRenderContent(context, views, now)
        if (!rendered) {
            views.setViewVisibility(R.id.widget_content, View.GONE)
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    /**
     * Savunmacı doğrulama: aşağıdakilerin HERHANGİ birinde false döner ve
     * çağıran taraf boş durumu gösterir. Yanlış bir saat göstermek, hiçbir
     * saat göstermemekten çok daha kötüdür (design-refresh-v3 Faz 23
     * Commit 4, açık gereksinim).
     */
    private fun tryRenderContent(context: Context, views: RemoteViews, now: Long): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(PAYLOAD_KEY, null) ?: return false

        val json = try {
            JSONObject(raw)
        } catch (e: Exception) {
            return false
        }

        if (json.optInt("schemaVersion", -1) != SCHEMA_VERSION) return false

        val timeZone = json.optString("timeZone", "")
        val locationLabel = json.optString("locationLabel", "")
        val entriesJson = json.optJSONArray("entries") ?: return false
        if (entriesJson.length() == 0) return false

        val entries = ArrayList<WidgetEntry>(entriesJson.length())
        for (i in 0 until entriesJson.length()) {
            val e = entriesJson.optJSONObject(i) ?: return false
            entries.add(
                WidgetEntry(
                    name = e.optString("name", ""),
                    label = e.optString("label", ""),
                    atMs = e.optLong("atMs", -1L)
                )
            )
        }

        // Veri bayatlamış: son giriş bile geçmişteyse tüm pencere tükenmiş demektir.
        if (entries.last().atMs <= now) return false

        val activeIndex = entries.indexOfLast { it.atMs <= now }
        // now, entries[0]'dan (bugünün imsakı) önce — gece yarısı ile imsak
        // arasındaki dar aralık, bu yükün kapsamadığı dünkü yatsı vaktine
        // denk düşer. Yanlış vakit göstermemek için boş durum.
        if (activeIndex == -1) return false
        // Stale kontrolü zaten son girişi elediği için burası her zaman geçerli bir "sonraki" bırakır.
        val nextIndex = activeIndex + 1
        if (nextIndex >= entries.size) return false

        val active = entries[activeIndex]
        val next = entries[nextIndex]

        views.setTextViewText(R.id.widget_location, locationLabel)
        views.setTextViewText(R.id.widget_active_prayer_name, active.label)
        views.setTextViewText(
            R.id.widget_window_range,
            "${formatTime(active.atMs, timeZone)} → ${formatTime(next.atMs, timeZone)}"
        )

        views.setChronometerCountDown(R.id.widget_countdown, true)
        val elapsedRealtimeTarget = SystemClock.elapsedRealtime() + (next.atMs - now)
        views.setChronometer(R.id.widget_countdown, elapsedRealtimeTarget, null, true)

        renderDailyRow(views, entries, activeIndex, nextIndex, timeZone)

        views.setViewVisibility(R.id.widget_content, View.VISIBLE)
        views.setViewVisibility(R.id.widget_empty, View.GONE)
        return true
    }

    private fun renderDailyRow(
        views: RemoteViews,
        entries: List<WidgetEntry>,
        activeIndex: Int,
        nextIndex: Int,
        timeZone: String
    ) {
        val dayBlockStart = (activeIndex / 6) * 6
        val dayBlockEnd = dayBlockStart + 6
        val nameIds = intArrayOf(
            R.id.widget_prayer_name_0, R.id.widget_prayer_name_1, R.id.widget_prayer_name_2,
            R.id.widget_prayer_name_3, R.id.widget_prayer_name_4, R.id.widget_prayer_name_5
        )
        val timeIds = intArrayOf(
            R.id.widget_prayer_time_0, R.id.widget_prayer_time_1, R.id.widget_prayer_time_2,
            R.id.widget_prayer_time_3, R.id.widget_prayer_time_4, R.id.widget_prayer_time_5
        )
        val highlightIndex = selectHighlightIndex(activeIndex, nextIndex, dayBlockStart, dayBlockEnd)

        for (slot in 0 until 6) {
            val entryIndex = dayBlockStart + slot
            if (entryIndex >= entries.size) {
                views.setTextViewText(nameIds[slot], "")
                views.setTextViewText(timeIds[slot], "")
                continue
            }
            val entry = entries[entryIndex]
            views.setTextViewText(nameIds[slot], entry.label)
            views.setTextViewText(timeIds[slot], formatTime(entry.atMs, timeZone))
            // RemoteViews.setTextColor wants a resolved color int, not a
            // resource id — mirrors colors.xml's widget_text_primary/
            // widget_text_secondary values (no Context/Resources available
            // in this static-ish helper without threading it through).
            // widget_accent is intentionally not used here: the countdown is
            // the single accent-colored primary element, this row stays
            // neutral so it doesn't compete for attention.
            val color = if (entryIndex == highlightIndex) 0xFFECEAE3.toInt() else 0xFFABA89F.toInt()
            views.setTextColor(nameIds[slot], color)
            views.setTextColor(timeIds[slot], color)
        }
    }

    private fun formatTime(atMs: Long, timeZone: String): String {
        val formatter = SimpleDateFormat("HH:mm", Locale("tr", "TR"))
        if (timeZone.isNotEmpty()) {
            formatter.timeZone = TimeZone.getTimeZone(timeZone)
        }
        return formatter.format(Date(atMs))
    }

    private fun scheduleNextBoundaryAlarm(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(PAYLOAD_KEY, null) ?: return
        val json = try {
            JSONObject(raw)
        } catch (e: Exception) {
            return
        }
        val entriesJson = json.optJSONArray("entries") ?: return
        val now = System.currentTimeMillis()

        var nextBoundary = -1L
        for (i in 0 until entriesJson.length()) {
            val atMs = entriesJson.optJSONObject(i)?.optLong("atMs", -1L) ?: continue
            if (atMs > now) {
                nextBoundary = atMs
                break
            }
        }
        if (nextBoundary <= 0) return

        // Tam alarm izni istemiyoruz: setWindow yaklaşık teslimat için
        // yeterli — Chronometer 00:00 gösterir, birkaç saniye/dakika sonra
        // yeniden çizilir (design-refresh-v3 Faz 23 Commit 4).
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerElapsedRealtime = SystemClock.elapsedRealtime() + (nextBoundary - now)
        val windowLengthMs = 5 * 60 * 1000L
        alarmManager.setWindow(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            triggerElapsedRealtime,
            windowLengthMs,
            boundaryAlarmPendingIntent(context)
        )
    }
}
