package com.vakit.widget

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF

/**
 * Geometri (computeGeometry) Canvas'tan bilerek ayrılmıştır: saf Kotlin,
 * hiçbir android.graphics sınıfına dokunmaz, bu yüzden JVM unit testleriyle
 * (ArcRendererTest) doğrulanabilir. render() ise gerçek bitmap'i çizer —
 * bunun görsel doğruluğu bu testlerle DOĞRULANAMAZ, yalnızca açı
 * aritmetiği (computeGeometry) test edilir.
 *
 * segments.trueStart/trueEnd/renderStart/elapsedEnd hesabı,
 * src/components/SunArcDial.tsx'teki aynı isimli değişkenlerin (gapFrac
 * dahil) birebir Kotlin karşılığıdır — iki taraf da aynı imsak-imsak
 * döngüsünü, gerçek vakit süresiyle orantılı segmentler halinde çizer.
 */
object ArcRenderer {

    private const val SEGMENT_COUNT = 6
    private const val REMAINDER_ALPHA = 102 // 255 * 0.40 ≈ %40 opaklık
    private const val MARKER_BORDER_WIDTH_PX = 2f

    internal data class ArcSegment(
        val trueStart: Float,
        val trueEnd: Float,
        val renderStart: Float,
        val elapsedEnd: Float,
        val hasElapsed: Boolean
    )

    internal data class ArcGeometry(val segments: List<ArcSegment>, val progress: Float)

    /**
     * boundaries: dayCycleStart..dayCycleEnd'i sınırlayan 7 zaman damgası
     * (entries[dayBlockStart..dayBlockStart+6].atMs) — 6 segment üretir.
     * gapFrac, çağıran tarafın gerçek piksel yarıçapından hesapladığı
     * segment-başı boşluk oranıdır (bkz. render()).
     */
    internal fun computeGeometry(boundaries: List<Long>, now: Long, gapFrac: Float): ArcGeometry? {
        if (boundaries.size != SEGMENT_COUNT + 1) return null
        val dayCycleStart = boundaries.first()
        val dayCycleEnd = boundaries.last()
        val totalMs = dayCycleEnd - dayCycleStart
        if (totalMs <= 0) return null

        val progress = ((now - dayCycleStart).toDouble() / totalMs).toFloat().coerceIn(0f, 1f)

        val segments = (0 until SEGMENT_COUNT).map { i ->
            val trueStart = ((boundaries[i] - dayCycleStart).toDouble() / totalMs).toFloat()
            val trueEnd = ((boundaries[i + 1] - dayCycleStart).toDouble() / totalMs).toFloat()
            val renderStart = minOf(trueStart + gapFrac, trueEnd)
            val elapsedEnd = maxOf(renderStart, minOf(trueEnd, progress))
            ArcSegment(trueStart, trueEnd, renderStart, elapsedEnd, elapsedEnd > renderStart)
        }
        return ArcGeometry(segments, progress)
    }

    /**
     * sizePx <= 0, boundaries eksik/bozuk veya dayCycleEnd <= dayCycleStart
     * ise null döner — çağıran taraf bu durumda hiçbir şey çizmemeli.
     */
    fun render(
        sizePx: Int,
        boundaries: List<Long>,
        now: Long,
        segmentColors: IntArray,
        remainderColor: Int,
        markerColor: Int,
        markerBorderColor: Int
    ): Bitmap? {
        if (sizePx <= 0 || segmentColors.size != SEGMENT_COUNT) return null

        val strokeWidthPx = sizePx * 6f / 160f
        val radius = (sizePx - strokeWidthPx) / 2f
        if (radius <= 0f) return null

        val circumference = 2f * Math.PI.toFloat() * radius
        val gapFrac = 3f / circumference
        val geometry = computeGeometry(boundaries, now, gapFrac) ?: return null

        val cx = sizePx / 2f
        val cy = sizePx / 2f
        val oval = RectF(cx - radius, cy - radius, cx + radius, cy + radius)

        val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val arcPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = strokeWidthPx
            strokeCap = Paint.Cap.BUTT
        }

        geometry.segments.forEachIndexed { index, seg ->
            arcPaint.color = withAlpha(remainderColor, REMAINDER_ALPHA)
            canvas.drawArc(oval, angleOf(seg.renderStart), sweepOf(seg.renderStart, seg.trueEnd), false, arcPaint)

            if (seg.hasElapsed) {
                arcPaint.color = segmentColors[index]
                canvas.drawArc(oval, angleOf(seg.renderStart), sweepOf(seg.renderStart, seg.elapsedEnd), false, arcPaint)
            }
        }

        val (markerX, markerY) = pointOnCircle(cx, cy, radius, geometry.progress)
        val markerRadius = strokeWidthPx * 1.4f

        val markerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
            color = markerColor
        }
        canvas.drawCircle(markerX, markerY, markerRadius, markerPaint)

        val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = MARKER_BORDER_WIDTH_PX
            color = markerBorderColor
        }
        canvas.drawCircle(markerX, markerY, markerRadius - MARKER_BORDER_WIDTH_PX / 2f, borderPaint)

        return bitmap
    }

    private fun withAlpha(color: Int, alpha: Int): Int =
        Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color))

    /** Saat 12 yönü = -90°; pozitif sweep saat yönünde ilerler (Android Canvas açı uzlaşımı). */
    private fun angleOf(fraction: Float): Float = fraction * 360f - 90f

    private fun sweepOf(startFrac: Float, endFrac: Float): Float = (endFrac - startFrac) * 360f

    /** dialGeometry.ts'teki polarPoint'in birebir Kotlin karşılığı. */
    private fun pointOnCircle(cx: Float, cy: Float, r: Float, fraction: Float): Pair<Float, Float> {
        val theta = fraction * 2.0 * Math.PI
        val x = cx + r * Math.sin(theta)
        val y = cy - r * Math.cos(theta)
        return x.toFloat() to y.toFloat()
    }
}
