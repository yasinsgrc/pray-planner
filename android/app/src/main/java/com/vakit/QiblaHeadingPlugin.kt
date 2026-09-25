package com.vakit

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.view.Surface
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Pusula yönü. flutter_compass / flutter_qiblah ve diğer yaygın kıble
 * uygulamalarıyla aynı yol: yön ROTATION_VECTOR füzyonundan (jiroskop +
 * ivmeölçer + manyetometre) alınır; cihazda yoksa ivmeölçer +
 * manyetometreye düşülür. Telefon dik tutulduğunda (eğim > 45°) eksenler
 * yeniden eşlenir, aksi hâlde getOrientation azimutu kararsızlaşır.
 * Üstüne konuma göre manyetik sapma eklenerek gerçek kuzey bulunur.
 */
@CapacitorPlugin(name = "QiblaHeading")
class QiblaHeadingPlugin : Plugin(), SensorEventListener {
    private lateinit var sm: SensorManager
    private val grav = FloatArray(3)
    private val geo = FloatArray(3)
    private val rv = FloatArray(4)
    private var hasGrav = false
    private var hasGeo = false
    private var hasRv = false
    private var useRv = false
    private var magAccuracy = 0
    private var declination = 0f
    private var fieldUt = 0.0
    private var lastEmit = 0L
    private var running = false

    override fun load() {
        sm = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val lat = call.getDouble("lat")
        val lng = call.getDouble("lng")
        if (lat == null || lng == null) { call.reject("lat/lng gerekli"); return }
        useRv = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) != null
        if (!useRv && (sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) == null ||
                sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) == null)) {
            call.reject("unsupported"); return
        }
        declination = GeomagneticField(
            lat.toFloat(), lng.toFloat(), 0f, System.currentTimeMillis()
        ).declination
        running = true
        register()
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        running = false
        sm.unregisterListener(this)
        call.resolve()
    }

    override fun handleOnPause() { sm.unregisterListener(this) }
    override fun handleOnResume() { if (running) register() }

    private fun register() {
        sm.unregisterListener(this)
        hasGrav = false; hasGeo = false; hasRv = false
        // Manyetometre füzyon kullanılsa da dinlenir: doğruluk seviyesi ve
        // alan şiddeti (parazit tespiti) oradan geliyor.
        sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)?.let {
            sm.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        if (useRv) {
            sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)?.let {
                sm.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        } else {
            sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)?.let {
                sm.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {
        if (sensor.type == Sensor.TYPE_MAGNETIC_FIELD) magAccuracy = accuracy
    }

    override fun onSensorChanged(e: SensorEvent) {
        when (e.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> { lowPass(e.values, grav, hasGrav); hasGrav = true }
            Sensor.TYPE_MAGNETIC_FIELD -> {
                lowPass(e.values, geo, hasGeo); hasGeo = true
                // onAccuracyChanged bazı cihazlarda hiç çağrılmıyor; 0'da
                // kalırsa ibre sürekli "kalibre et" durumunda gizlenir.
                magAccuracy = e.accuracy
                val x = e.values[0]; val y = e.values[1]; val z = e.values[2]
                fieldUt = sqrt((x * x + y * y + z * z).toDouble())
            }
            Sensor.TYPE_ROTATION_VECTOR -> {
                // Bazı cihazlar 5 elemanlı dizi gönderiyor; eski API'ler
                // getRotationMatrixFromVector'da buna takılabiliyor.
                System.arraycopy(e.values, 0, rv, 0, minOf(4, e.values.size))
                if (e.values.size < 4) rv[3] = 0f
                hasRv = true
            }
        }
        val now = System.currentTimeMillis()
        if (now - lastEmit < 66) return
        val r = FloatArray(9)
        if (useRv) {
            if (!hasRv) return
            SensorManager.getRotationMatrixFromVector(r, rv)
        } else {
            if (!hasGrav || !hasGeo) return
            if (!SensorManager.getRotationMatrix(r, null, grav, geo)) return
        }
        lastEmit = now
        val mag = azimuth(r)
        val headingTrue = norm(mag + declination)
        val data = JSObject()
        data.put("headingTrue", headingTrue)
        data.put("headingMagnetic", mag)
        data.put("rvHeadingTrue", if (useRv) headingTrue else -1.0)
        data.put("declination", declination.toDouble())
        data.put("accuracy", magAccuracy)
        data.put("fieldUt", fieldUt)
        notifyListeners("heading", data)
    }

    private fun lowPass(input: FloatArray, out: FloatArray, initialized: Boolean) {
        for (i in 0..2) {
            out[i] = if (initialized) out[i] + 0.15f * (input[i] - out[i]) else input[i]
        }
    }

    /** flutter_compass'taki eksen eşlemesinin aynısı: önce ekran dönüşü,
     * sonra telefon dik/ters tutuluyorsa ona göre yeniden eşleme. */
    @Suppress("DEPRECATION")
    private fun azimuth(r: FloatArray): Double {
        val rotation = activity?.windowManager?.defaultDisplay?.rotation ?: Surface.ROTATION_0
        var (ax, ay) = when (rotation) {
            Surface.ROTATION_90 -> SensorManager.AXIS_Y to SensorManager.AXIS_MINUS_X
            Surface.ROTATION_180 -> SensorManager.AXIS_MINUS_X to SensorManager.AXIS_MINUS_Y
            Surface.ROTATION_270 -> SensorManager.AXIS_MINUS_Y to SensorManager.AXIS_X
            else -> SensorManager.AXIS_X to SensorManager.AXIS_Y
        }
        val out = FloatArray(9)
        val o = FloatArray(3)
        SensorManager.remapCoordinateSystem(r, ax, ay, out)
        SensorManager.getOrientation(out, o)

        val quarter = Math.PI / 4
        val tilted = when {
            o[1] < -quarter -> when (rotation) {
                Surface.ROTATION_90 -> SensorManager.AXIS_Z to SensorManager.AXIS_MINUS_X
                Surface.ROTATION_180 -> SensorManager.AXIS_MINUS_X to SensorManager.AXIS_MINUS_Z
                Surface.ROTATION_270 -> SensorManager.AXIS_MINUS_Z to SensorManager.AXIS_X
                else -> SensorManager.AXIS_X to SensorManager.AXIS_Z
            }
            o[1] > quarter -> when (rotation) {
                Surface.ROTATION_90 -> SensorManager.AXIS_MINUS_Z to SensorManager.AXIS_MINUS_X
                Surface.ROTATION_180 -> SensorManager.AXIS_MINUS_X to SensorManager.AXIS_Z
                Surface.ROTATION_270 -> SensorManager.AXIS_Z to SensorManager.AXIS_X
                else -> SensorManager.AXIS_X to SensorManager.AXIS_MINUS_Z
            }
            abs(o[2]) > Math.PI / 2 -> when (rotation) {
                Surface.ROTATION_90 -> SensorManager.AXIS_MINUS_Y to SensorManager.AXIS_MINUS_X
                Surface.ROTATION_180 -> SensorManager.AXIS_MINUS_X to SensorManager.AXIS_Y
                Surface.ROTATION_270 -> SensorManager.AXIS_Y to SensorManager.AXIS_X
                else -> SensorManager.AXIS_X to SensorManager.AXIS_MINUS_Y
            }
            else -> null
        }
        if (tilted != null) {
            ax = tilted.first; ay = tilted.second
            SensorManager.remapCoordinateSystem(r, ax, ay, out)
            SensorManager.getOrientation(out, o)
        }
        return norm(Math.toDegrees(o[0].toDouble()))
    }

    private fun norm(d: Double): Double = ((d % 360.0) + 360.0) % 360.0
}
