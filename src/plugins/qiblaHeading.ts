import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * Android'de pusula yönünün tek kaynağı. WebView'in
 * `deviceorientationabsolute` olayı (Chromium, ROTATION_VECTOR tabanlı)
 * gerçek cihazda 35-58° yanlış yön verdiği için yön, yerel tarafta
 * doğrudan accelerometer + magnetometer'dan hesaplanıyor
 * (QiblaHeadingPlugin.kt). Ayrı bir npm paketi değil, app-local eklenti.
 */
export interface QiblaHeadingSample {
  /** Gerçek kuzeye göre yön (manyetik + deklinasyon), 0-360. Kullanılacak değer bu. */
  headingTrue: number;
  /** Ham manyetik kuzey yönü, 0-360 — yalnızca teşhis için. */
  headingMagnetic: number;
  /**
   * ROTATION_VECTOR sensör füzyonunun aynı andaki gerçek-kuzey yönü.
   * -1 "okuma yok" demektir (cihazda sensör yok ya da henüz veri gelmedi);
   * WebView'in yanlış değeriyle aynı kaynak olduğu için yalnızca
   * karşılaştırma amacıyla taşınıyor, yön olarak kullanılmıyor.
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
