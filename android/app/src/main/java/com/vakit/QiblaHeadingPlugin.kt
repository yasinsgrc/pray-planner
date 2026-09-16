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
import kotlin.math.sqrt

@CapacitorPlugin(name = "QiblaHeading")
class QiblaHeadingPlugin : Plugin(), SensorEventListener {
    private lateinit var sm: SensorManager
    private val grav = FloatArray(3)
    private val geo = FloatArray(3)
    private var hasGrav = false
    private var hasGeo = false
    private var rvHeadingMag: Double? = null
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
        if (sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) == null ||
            sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) == null) {
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
        hasGrav = false; hasGeo = false; rvHeadingMag = null
        sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)?.let {
            sm.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)?.let {
            sm.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)?.let {
            sm.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    }

    override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {
        if (sensor.type == Sensor.TYPE_MAGNETIC_FIELD) magAccuracy = accuracy
    }

    override fun onSensorChanged(e: SensorEvent) {
        when (e.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> { lowPass(e.values, grav, hasGrav); hasGrav = true }
            Sensor.TYPE_MAGNETIC_FIELD -> {
                lowPass(e.values, geo, hasGeo); hasGeo = true
                val x = e.values[0]; val y = e.values[1]; val z = e.values[2]
                fieldUt = sqrt((x * x + y * y + z * z).toDouble())
            }
            Sensor.TYPE_ROTATION_VECTOR -> {
                val r = FloatArray(9)
                SensorManager.getRotationMatrixFromVector(r, e.values)
                rvHeadingMag = azimuth(r)
                return
            }
        }
        if (!hasGrav || !hasGeo) return
        val now = System.currentTimeMillis()
        if (now - lastEmit < 66) return
        lastEmit = now
        val r = FloatArray(9)
        if (!SensorManager.getRotationMatrix(r, null, grav, geo)) return
        val mag = azimuth(r)
        val data = JSObject()
        data.put("headingTrue", norm(mag + declination))
        data.put("headingMagnetic", mag)
        data.put("rvHeadingTrue", rvHeadingMag?.let { norm(it + declination) } ?: -1.0)
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

    @Suppress("DEPRECATION")
    private fun azimuth(r: FloatArray): Double {
        val rotation = activity?.windowManager?.defaultDisplay?.rotation ?: Surface.ROTATION_0
        val out = FloatArray(9)
        when (rotation) {
            Surface.ROTATION_90 -> SensorManager.remapCoordinateSystem(
                r, SensorManager.AXIS_Y, SensorManager.AXIS_MINUS_X, out)
            Surface.ROTATION_180 -> SensorManager.remapCoordinateSystem(
                r, SensorManager.AXIS_MINUS_X, SensorManager.AXIS_MINUS_Y, out)
            Surface.ROTATION_270 -> SensorManager.remapCoordinateSystem(
                r, SensorManager.AXIS_MINUS_Y, SensorManager.AXIS_X, out)
            else -> System.arraycopy(r, 0, out, 0, 9)
        }
        val o = FloatArray(3)
        SensorManager.getOrientation(out, o)
        return norm(Math.toDegrees(o[0].toDouble()))
    }

    private fun norm(d: Double): Double = ((d % 360.0) + 360.0) % 360.0
}
