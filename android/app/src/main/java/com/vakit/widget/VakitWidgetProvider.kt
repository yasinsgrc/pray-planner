package com.vakit.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.os.SystemClock
import android.util.TypedValue
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

/** activeIndex'in içinde bulunduğu 6'lı günlük vakit bloğunun başlangıcı. */
internal fun dayBlockStartFor(activeIndex: Int): Int = (activeIndex / 6) * 6

internal const val ONE_HOUR_MS = 3_600_000L

/**
 * Chronometer'ın format string'i: 1 saatin altında MM:SS iki haneli olduğu
 * için "08:37" hem 8dk37sn hem 8sa37dk okunabiliyordu — "00:" öneki bu
 * belirsizliği gideriyor. 1 saat ve üstünde H:MM:SS zaten üç gruplu ve
 * belirsiz değil, öneke gerek yok.
 */
internal fun countdownFormatFor(remainingMs: Long): String =
    if (remainingMs in 0 until ONE_HOUR_MS) "00:%s" else "%s"

/**
 * Format 1 saat sınırında değişmeli (countdownFormatFor), yoksa widget
 * 59:59'a düşene kadar önceki (belirsiz) formatta kalır. Sınır 1 saatten
 * uzaksa alarmı sınırdan bir saat önceye çekerek formatın tam zamanında
 * yenilenmesini sağlar; sınır zaten bir saat içindeyse doğrudan sınırda kurulur.
 */
internal fun nextRefreshAtMs(nextBoundaryMs: Long, now: Long): Long =
    if (nextBoundaryMs - ONE_HOUR_MS > now) nextBoundaryMs - ONE_HOUR_MS else nextBoundaryMs

/** Çember içi metinlerin (sayaç/konum/vakit adı) çember çapına (dp) oranlanmış puntoları. */
internal data class ArcTextSizes(val countdownSp: Float, val locationSp: Float, val prayerNameSp: Float)

private const val ARC_COUNTDOWN_SP_RATIO = 0.15f
private const val ARC_LOCATION_SP_RATIO = 0.085f
private const val ARC_PRAYER_NAME_SP_RATIO = 0.095f
private const val ARC_COUNTDOWN_MIN_SP = 14f
private const val ARC_SECONDARY_MIN_SP = 8f

/**
 * Sayaç/konum/vakit adı puntolarını çember çapına (dp) oranlayarak hesaplar.
 * Küçük çemberlerde ("3:33:17", "Küçükçekmece" gibi geniş metinlerin taşmasını
 * önlemek için) alt sınır uygulanır.
 */
internal fun arcTextSizesFor(circleDp: Float): ArcTextSizes {
    return ArcTextSizes(
        countdownSp = (circleDp * ARC_COUNTDOWN_SP_RATIO).coerceAtLeast(ARC_COUNTDOWN_MIN_SP),
        locationSp = (circleDp * ARC_LOCATION_SP_RATIO).coerceAtLeast(ARC_SECONDARY_MIN_SP),
        prayerNameSp = (circleDp * ARC_PRAYER_NAME_SP_RATIO).coerceAtLeast(ARC_SECONDARY_MIN_SP)
    )
}

/** Alt sıradaki 6 vakit hücresinin (ad/saat) widget genişliğine (dp) oranlanmış puntoları. */
internal data class DailyRowTextSizes(val prayerNameSp: Float, val prayerTimeSp: Float)

private const val ROW_PRAYER_NAME_SP_RATIO = 0.032f
private const val ROW_PRAYER_TIME_SP_RATIO = 0.040f
private const val ROW_PRAYER_NAME_MIN_SP = 9f
private const val ROW_PRAYER_NAME_MAX_SP = 12f
private const val ROW_PRAYER_TIME_MIN_SP = 11f
private const val ROW_PRAYER_TIME_MAX_SP = 15f

/**
 * Vakit adı/saat puntolarını widget genişliğine (dp) oranlayarak hesaplar.
 * 6 kolonlu dar widget'larda ("Güneş"/"İkindi" gibi) ellipsize'a düşmemesi
 * için üst sınır, çok dar widget'larda okunabilirlik için alt sınır uygulanır.
 */
internal fun dailyRowTextSizesFor(widthDp: Float): DailyRowTextSizes {
    return DailyRowTextSizes(
        prayerNameSp = (widthDp * ROW_PRAYER_NAME_SP_RATIO).coerceIn(ROW_PRAYER_NAME_MIN_SP, ROW_PRAYER_NAME_MAX_SP),
        prayerTimeSp = (widthDp * ROW_PRAYER_TIME_SP_RATIO).coerceIn(ROW_PRAYER_TIME_MIN_SP, ROW_PRAYER_TIME_MAX_SP)
    )
}

class VakitWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val PREFS_NAME = "CapacitorStorage"
        private const val PAYLOAD_KEY = "vakit_widget_payload_v1"
        private const val SCHEMA_VERSION = 1
        const val ACTION_REFRESH_BOUNDARY = "com.vakit.widget.ACTION_REFRESH_BOUNDARY"
        const val ACTION_PERIODIC_REFRESH = "com.vakit.widget.ACTION_PERIODIC_REFRESH"
        private const val BOUNDARY_ALARM_REQUEST_CODE = 0
        private const val PERIODIC_ALARM_REQUEST_CODE = 1
        private const val PERIODIC_REFRESH_INTERVAL_MS = 15 * 60 * 1000L

        /** RemoteViews Binder ~1MB sınırını korumak için bitmap kenarına üst sınır (ARGB_8888, 384px ≈ 589KB). */
        internal const val MAX_ARC_BITMAP_PX = 384

        /** Çember içi metin bloğunun yatay padding'i, çember çapının (dp) yüzdesi olarak. */
        private const val ARC_TEXT_PADDING_RATIO = 0.10f

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
                context, BOUNDARY_ALARM_REQUEST_CODE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        /** Sınır alarmının request code'unu (0) ezmemek için ayrı bir request code (1) kullanır. */
        private fun periodicAlarmPendingIntent(context: Context): PendingIntent {
            val intent = Intent(context, VakitWidgetProvider::class.java).apply {
                action = ACTION_PERIODIC_REFRESH
            }
            return PendingIntent.getBroadcast(
                context, PERIODIC_ALARM_REQUEST_CODE, intent,
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
        schedulePeriodicRefreshAlarm(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        // Widget yeniden boyutlandırıldığında arc bitmap'i yeni boyuta göre yeniden çizilmeli.
        updateWidget(context, appWidgetManager, appWidgetId)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_BOOT_COMPLETED,
            ACTION_REFRESH_BOUNDARY,
            ACTION_PERIODIC_REFRESH -> updateAllWidgets(context)
        }
    }

    override fun onDisabled(context: Context) {
        // Son widget örneği kaldırıldığında her iki alarmı da iptal et —
        // aksi halde sahipsiz alarmlar gereksiz yere ateşlenmeye devam eder.
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(boundaryAlarmPendingIntent(context))
        alarmManager.cancel(periodicAlarmPendingIntent(context))
    }

    /**
     * Sınır alarmı (scheduleNextBoundaryAlarm) yalnızca bir sonraki vakit
     * sınırında ateşlenir; bu ek ~15 dk periyotlu alarm, aradaki sürede
     * widget boyutu/veri tazeliği gibi durumların çok gecikmeden
     * yansımasını sağlar. setInexactRepeating kullanılır — setExact* YOK,
     * yeni bir izin gerekmez.
     */
    private fun schedulePeriodicRefreshAlarm(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.setInexactRepeating(
            AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + PERIODIC_REFRESH_INTERVAL_MS,
            PERIODIC_REFRESH_INTERVAL_MS,
            periodicAlarmPendingIntent(context)
        )
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
        val rendered = tryRenderContent(context, appWidgetManager, appWidgetId, views, now)
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
    private fun tryRenderContent(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        views: RemoteViews,
        now: Long
    ): Boolean {
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

        views.setChronometerCountDown(R.id.widget_countdown, true)
        val elapsedRealtimeTarget = SystemClock.elapsedRealtime() + (next.atMs - now)
        views.setChronometer(R.id.widget_countdown, elapsedRealtimeTarget, countdownFormatFor(next.atMs - now), true)

        val dayBlockStart = dayBlockStartFor(activeIndex)
        renderDailyRow(views, entries, activeIndex, nextIndex, dayBlockStart, timeZone)
        applyArcTextSizing(context, appWidgetManager, appWidgetId, views)
        renderArc(context, appWidgetManager, appWidgetId, views, entries, dayBlockStart, now)

        views.setViewVisibility(R.id.widget_content, View.VISIBLE)
        views.setViewVisibility(R.id.widget_empty, View.GONE)
        return true
    }

    private fun renderDailyRow(
        views: RemoteViews,
        entries: List<WidgetEntry>,
        activeIndex: Int,
        nextIndex: Int,
        dayBlockStart: Int,
        timeZone: String
    ) {
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

    /**
     * Çember içi metinlerin (sayaç/konum/vakit adı) puntosunu ve metin
     * bloğunun yatay padding'ini widget'ın gerçek boyutuna (dp) göre
     * ölçekler. Boyut bilinmiyorsa (getAppWidgetOptions MIN_WIDTH/MIN_HEIGHT
     * 0/eksik) XML'deki varsayılan (platform) punto/padding korunur — arc'ın
     * gone bırakılmasından bağımsız bir savunmacı yol.
     */
    private fun applyArcTextSizing(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        views: RemoteViews
    ) {
        val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
        val minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
        val minHeightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
        if (minWidthDp <= 0 || minHeightDp <= 0) return

        val circleDp = minOf(minWidthDp, minHeightDp).toFloat()
        val sizes = arcTextSizesFor(circleDp)
        views.setTextViewTextSize(R.id.widget_countdown, TypedValue.COMPLEX_UNIT_SP, sizes.countdownSp)
        views.setTextViewTextSize(R.id.widget_location, TypedValue.COMPLEX_UNIT_SP, sizes.locationSp)
        views.setTextViewTextSize(R.id.widget_active_prayer_name, TypedValue.COMPLEX_UNIT_SP, sizes.prayerNameSp)

        val density = context.resources.displayMetrics.density
        val paddingPx = (circleDp * ARC_TEXT_PADDING_RATIO * density).toInt()
        views.setViewPadding(R.id.widget_arc_text_block, paddingPx, 0, paddingPx, 0)

        val rowSizes = dailyRowTextSizesFor(minWidthDp.toFloat())
        val nameIds = intArrayOf(
            R.id.widget_prayer_name_0, R.id.widget_prayer_name_1, R.id.widget_prayer_name_2,
            R.id.widget_prayer_name_3, R.id.widget_prayer_name_4, R.id.widget_prayer_name_5
        )
        val timeIds = intArrayOf(
            R.id.widget_prayer_time_0, R.id.widget_prayer_time_1, R.id.widget_prayer_time_2,
            R.id.widget_prayer_time_3, R.id.widget_prayer_time_4, R.id.widget_prayer_time_5
        )
        for (id in nameIds) views.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, rowSizes.prayerNameSp)
        for (id in timeIds) views.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, rowSizes.prayerTimeSp)
    }

    /**
     * dayBlockStart..dayBlockStart+6 aralığı entries'te tam yoksa (payload
     * bu kadar ileri gitmiyorsa) veya widget boyutu henüz bilinmiyorsa
     * (getAppWidgetOptions MIN_WIDTH/MIN_HEIGHT 0/eksik gelirse) arc
     * gizli bırakılır — mevcut düzen bozulmaz.
     */
    private fun renderArc(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        views: RemoteViews,
        entries: List<WidgetEntry>,
        dayBlockStart: Int,
        now: Long
    ) {
        val dayBlockEnd = dayBlockStart + 6
        if (dayBlockEnd >= entries.size) {
            views.setViewVisibility(R.id.widget_arc, View.GONE)
            return
        }

        val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
        val minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
        val minHeightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
        if (minWidthDp <= 0 || minHeightDp <= 0) {
            views.setViewVisibility(R.id.widget_arc, View.GONE)
            return
        }

        val density = context.resources.displayMetrics.density
        val sizePx = (minOf(minWidthDp, minHeightDp) * density).toInt().coerceAtMost(MAX_ARC_BITMAP_PX)
        if (sizePx <= 0) {
            views.setViewVisibility(R.id.widget_arc, View.GONE)
            return
        }

        val boundaries = (dayBlockStart..dayBlockEnd).map { entries[it].atMs }
        val segmentColors = intArrayOf(
            context.getColor(R.color.widget_v_imsak),
            context.getColor(R.color.widget_v_gunes),
            context.getColor(R.color.widget_v_ogle),
            context.getColor(R.color.widget_v_ikindi),
            context.getColor(R.color.widget_v_aksam),
            context.getColor(R.color.widget_v_yatsi)
        )

        val bitmap = ArcRenderer.render(
            sizePx = sizePx,
            boundaries = boundaries,
            now = now,
            segmentColors = segmentColors,
            remainderColor = context.getColor(R.color.widget_text_secondary),
            markerColor = context.getColor(R.color.widget_accent),
            markerBorderColor = Color.WHITE
        )

        if (bitmap == null) {
            views.setViewVisibility(R.id.widget_arc, View.GONE)
            return
        }
        views.setImageViewBitmap(R.id.widget_arc, bitmap)
        views.setViewVisibility(R.id.widget_arc, View.VISIBLE)
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
        // nextRefreshAtMs: sınır 1 saatten uzaksa erken uyanarak countdown
        // format geçişini (countdownFormatFor) tam zamanında tetikler.
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val refreshAtMs = nextRefreshAtMs(nextBoundary, now)
        val triggerElapsedRealtime = SystemClock.elapsedRealtime() + (refreshAtMs - now)
        val windowLengthMs = 5 * 60 * 1000L
        alarmManager.setWindow(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            triggerElapsedRealtime,
            windowLengthMs,
            boundaryAlarmPendingIntent(context)
        )
    }
}
