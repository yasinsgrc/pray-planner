import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * Android'de pusula yönünün tek kaynağı. Yön yerel tarafta,
 * flutter_compass / flutter_qiblah ile aynı yoldan hesaplanıyor:
 * ROTATION_VECTOR füzyonu (yoksa accelerometer + magnetometer), dik tutma
 * için eksen yeniden eşleme ve manyetik sapma (QiblaHeadingPlugin.kt).
 * Ayrı bir npm paketi değil, app-local eklenti.
 */
export interface QiblaHeadingSample {
  /** Gerçek kuzeye göre yön (manyetik + deklinasyon), 0-360. Kullanılacak değer bu. */
  headingTrue: number;
  /** Ham manyetik kuzey yönü, 0-360 — yalnızca teşhis için. */
  headingMagnetic: number;
  /**
   * Yön ROTATION_VECTOR füzyonundan geliyorsa headingTrue ile aynı değer;
   * -1 cihazda füzyon sensörü olmadığı (accelerometer + magnetometer
   * yedeğine düşüldüğü) anlamına gelir. Yalnızca teşhis için.
   */
  rvHeadingTrue: number;
  /** Konuma göre manyetik sapma (derece), gerçek kuzey düzeltmesi. */
  declination: number;
  /** SensorManager doğruluk seviyesi: 0 unreliable … 3 high. */
  accuracy: number;
  /** Ölçülen manyetik alan şiddeti (µT) — parazit tespiti için. */
  fieldUt: number;
}

export interface QiblaHeadingPlugin {
  /** Deklinasyon konuma bağlı olduğu için lat/lng zorunlu. */
  start(options: { lat: number; lng: number }): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: 'heading',
    listener: (sample: QiblaHeadingSample) => void
  ): Promise<PluginListenerHandle>;
}

export const QiblaHeading = registerPlugin<QiblaHeadingPlugin>('QiblaHeading');
