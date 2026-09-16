import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { QiblaHeading } from '../plugins/qiblaHeading';
import { assessHeadingReliability, HeadingReliability } from '../utils/compassHeading';
import {
  applyScreenOrientationCompensation,
  computeHeadingFromOrientationEvent,
  computeHeadingDrift,
  computeHeadingStats,
  classifyDriftCharacter,
  summarizePlatform,
  determineActiveEventType,
  getAngularDifference,
  smoothHeading,
  INITIAL_SMOOTHER_STATE,
  CircularSmootherState,
  HeadingStats,
  DriftCharacter,
  ActiveEventType,
} from '../utils/compassHeading';

export type CompassPermissionState = 'idle' | 'granted' | 'denied' | 'unsupported';

/** Yönü fiilen üreten katman. */
export type HeadingSource = 'native-accmag' | 'web';

/**
 * Android WebView'in `deviceorientationabsolute` olayı (Chromium,
 * ROTATION_VECTOR tabanlı) gerçek cihazda aynı noktada 35-58° yanlış yön
 * veriyor — açı hesabı (adhan) doğru olduğu hâlde. Aynı konumda doğru
 * çalışan başka uygulamalar yönü sensörlerden kendileri hesaplıyor; biz de
 * Android'de yönü QiblaHeadingPlugin'den (accelerometer + magnetometer)
 * alıyoruz ve web olaylarına hiç abone olmuyoruz: iki kaynağın aynı anda
 * çalışması hatayı geri getirir.
 */
function isAndroidPlatform(): boolean {
  try {
    return Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export interface CompassDebugInfo {
  alpha: number | null;
  webkitCompassHeading: number | undefined;
  webkitCompassAccuracy: number | undefined;
  isAbsolute: boolean;
  screenAngle: number;
  rawHeading: number | null;
  smoothedHeading: number | null;
  /** Degrees travelled between the oldest and newest reading in the last
   * DRIFT_WINDOW_MS — null until that much time has actually elapsed.
   * Real-device report: heading drifts progressively, not by a fixed
   * offset (design-refresh-v3 Faz 20 madde 3). This measures it instead of
   * guessing; it does not, by itself, prove or disable anything. */
  driftDeg: number | null;
  /** Which source actually produced the current heading — not inferred
   * after the fact, set directly by whichever handler fired (design-
   * refresh-v3 Faz 21 madde 2: "hangi API'nin aktif olduğu"). */
  activeEventType: ActiveEventType;
  /** The very first usable raw heading this session — a fixed reference
   * point to compare everything else against. */
  firstRawHeadingDeg: number | null;
  /** Short "platform · browser" label — computed once per session, not per event. */
  userAgentSummary: string;
  /** min/max/average/spread over the last DRIFT_WINDOW_MS — lets the panel
   * tell a fixed offset (could be declination) apart from a growing one
   * (sensor fusion issue), which a single number can't. */
  stats: HeadingStats | null;
  driftCharacter: DriftCharacter;
  /** Yönü fiilen üreten katman — Android'de yerel eklenti, geri kalanda WebView. */
  source: HeadingSource;
  /** Yerel eklentinin uyguladığı manyetik sapma (derece); web yolunda null. */
  declination: number | null;
  /** SensorManager doğruluk seviyesi 0-3; web yolunda null. */
  accuracy: number | null;
  /** Ölçülen manyetik alan şiddeti (µT); web yolunda null. */
  fieldUt: number | null;
  /** ROTATION_VECTOR füzyonunun aynı andaki gerçek-kuzey yönü — WebView'in
   * kullandığı kaynakla aynı; yalnızca acc+mag ile farkını görmek için
   * taşınıyor. Okuma yoksa null. */
  rvHeadingTrue: number | null;
  reliability: HeadingReliability;
}

export interface CompassHeadingState {
  /** Smoothed + screen-orientation-compensated heading, ready to use. */
  heading: number | null;
  permissionState: CompassPermissionState;
  requestPermission: () => Promise<void>;
  /** iOS: low/invalid webkitCompassAccuracy. Android: raw heading jittering
   * more than a real hand tremor would explain — both mean "the sensor
   * itself isn't trustworthy right now", not a code bug. */
  needsCalibration: boolean;
  /** Yerel sensör okumasının kullanılabilirliği. Web yolunda ölçülemediği
   * için 'unknown' kalır. */
  reliability: HeadingReliability;
  debug: CompassDebugInfo;
}

interface DeviceOrientationEventWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

interface DeviceOrientationEventWithExtras extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

const NO_DATA_TIMEOUT_MS = 5000;
// Android has no standard accuracy field on the orientation event, so
// calibration need is inferred from how much the raw (pre-smoothing)
// heading jitters within a short recent window — a real hand tremor while
// holding a phone still is only a few degrees; a miscalibrated
// magnetometer routinely swings much further (design-refresh-v3 Faz 13).
const JITTER_WINDOW_SIZE = 8;
const JITTER_THRESHOLD_DEG = 20;
// iOS: negative accuracy means "invalid", per Apple's own semantics; a
// large positive value means the heading could be off by that many
// degrees — either way, not trustworthy enough to point someone at Mecca.
const IOS_ACCURACY_THRESHOLD_DEG = 15;
// design-refresh-v3 Faz 20 madde 3: how far back the drift measurement
// looks. Matches the exact window the user was asked to read off manually
// ("aynı fiziksel yönde dururken 60 saniyede kaç derece kaydı").
const DRIFT_WINDOW_MS = 60_000;
// Sampling more often than this would just bloat the buffer without adding
// precision — one sample every few seconds is plenty to measure a 60s trend.
const DRIFT_SAMPLE_INTERVAL_MS = 2000;

function getScreenAngle(): number {
  return window.screen.orientation?.angle ?? 0;
}

export function useCompassHeading(active: boolean, lat: number, lng: number): CompassHeadingState {
  const isAndroid = isAndroidPlatform();
  const [heading, setHeading] = useState<number | null>(null);
  // Android'de yerel sensör okuması ayrı bir kullanıcı izni gerektirmediği
  // için "Pusulayı Etkinleştir" adımı yok; izin akışı yalnızca iOS/web'de var.
  const [permissionState, setPermissionState] = useState<CompassPermissionState>(() =>
    isAndroidPlatform() ? 'granted' : 'idle'
  );
  const [needsCalibration, setNeedsCalibration] = useState(false);
  const [reliability, setReliability] = useState<HeadingReliability>('unknown');
  const [debug, setDebug] = useState<CompassDebugInfo>({
    alpha: null,
    webkitCompassHeading: undefined,
    webkitCompassAccuracy: undefined,
    isAbsolute: false,
    screenAngle: 0,
    rawHeading: null,
    smoothedHeading: null,
    driftDeg: null,
    activeEventType: 'none',
    firstRawHeadingDeg: null,
    userAgentSummary: '',
    stats: null,
    driftCharacter: 'insufficient-data',
    source: isAndroidPlatform() ? 'native-accmag' : 'web',
    declination: null,
    accuracy: null,
    fieldUt: null,
    rvHeadingTrue: null,
    reliability: 'unknown',
  });
  const hasUsableHeadingRef = useRef(false);
  const smootherRef = useRef<CircularSmootherState>(INITIAL_SMOOTHER_STATE);
  const jitterWindowRef = useRef<number[]>([]);
  const driftBufferRef = useRef<{ heading: number; t: number }[]>([]);
  const firstRawHeadingRef = useRef<number | null>(null);

  const requestPermission = useCallback(async () => {
    // Android yerel yolu izin istemez; buraya yalnızca "Tekrar Dene"
    // düğmesinden düşülebilir ve orada da yapılacak bir şey yok.
    if (isAndroidPlatform()) {
      setPermissionState('granted');
      return;
    }

    if (typeof DeviceOrientationEvent === 'undefined') {
      setPermissionState('unsupported');
      return;
    }

    const DOE = DeviceOrientationEvent as unknown as DeviceOrientationEventWithPermission;

    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        setPermissionState(result === 'granted' ? 'granted' : 'denied');
      } catch {
        setPermissionState('denied');
      }
    } else {
      setPermissionState('granted');
    }
  }, []);

  // Android: yön yerel eklentiden gelir. Eklenti ekran dönüşünü zaten
  // remapCoordinateSystem ile telafi ediyor ve okumayı alçak geçiren
  // filtreden geçiriyor; burada ikinci kez yumuşatmak ya da ekran açısını
  // tekrar eklemek yönü bozar.
  useEffect(() => {
    if (!active || !isAndroid) return;

    let cancelled = false;
    let handle: PluginListenerHandle | null = null;

    const subscribe = async () => {
      try {
        const listener = await QiblaHeading.addListener('heading', (sample) => {
          if (cancelled) return;
          const sampleReliability = assessHeadingReliability({
            accuracy: sample.accuracy,
            fieldUt: sample.fieldUt,
          });
          setHeading(sample.headingTrue);
          setReliability(sampleReliability);
          setNeedsCalibration(sampleReliability === 'calibrate');
          setDebug((prev) => ({
            ...prev,
            source: 'native-accmag',
            rawHeading: sample.headingMagnetic,
            smoothedHeading: null,
            declination: sample.declination,
            accuracy: sample.accuracy,
            fieldUt: sample.fieldUt,
            rvHeadingTrue: sample.rvHeadingTrue === -1 ? null : sample.rvHeadingTrue,
            reliability: sampleReliability,
          }));
        });
        if (cancelled) {
          await listener.remove();
          return;
        }
        handle = listener;
        await QiblaHeading.start({ lat, lng });
        if (!cancelled) setPermissionState('granted');
      } catch {
        // Eklenti yoksa ya da cihazda accelerometer/magnetometer yoksa:
        // sessizce web yoluna düşmek, aynı yanlış yönü geri getirirdi.
        if (!cancelled) setPermissionState('unsupported');
      }
    };

    void subscribe();

    return () => {
      cancelled = true;
      void handle?.remove();
      void QiblaHeading.stop();
    };
  }, [active, isAndroid, lat, lng]);

  useEffect(() => {
    if (!active || isAndroid || permissionState !== 'granted') return;

    hasUsableHeadingRef.current = false;
    smootherRef.current = INITIAL_SMOOTHER_STATE;
    jitterWindowRef.current = [];
    driftBufferRef.current = [];
    firstRawHeadingRef.current = null;
    const userAgentSummary = summarizePlatform(navigator.userAgent);

    function acceptEvent(
      event: DeviceOrientationEventWithExtras,
      isAbsolute: boolean,
      eventSourceName: 'deviceorientationabsolute' | 'deviceorientation'
    ) {
      const rawHeading = computeHeadingFromOrientationEvent({
        webkitCompassHeading: event.webkitCompassHeading,
        alpha: event.alpha,
        absolute: isAbsolute,
      });

      const screenAngle = getScreenAngle();
      const iosAccuracy = event.webkitCompassAccuracy;

      if (rawHeading === null) {
        setDebug((prev) => ({
          ...prev,
          alpha: event.alpha,
          webkitCompassHeading: event.webkitCompassHeading,
          webkitCompassAccuracy: iosAccuracy,
          isAbsolute,
          screenAngle,
          rawHeading: null,
        }));
        return;
      }

      hasUsableHeadingRef.current = true;
      if (firstRawHeadingRef.current === null) firstRawHeadingRef.current = rawHeading;
      const activeEventType = determineActiveEventType(event.webkitCompassHeading, eventSourceName);

      // Jitter window tracks the RAW heading (pre-smoothing) — smoothing
      // would mask exactly the noise this is meant to detect.
      const window = jitterWindowRef.current;
      window.push(rawHeading);
      if (window.length > JITTER_WINDOW_SIZE) window.shift();
      let maxSpread = 0;
      for (let i = 0; i < window.length; i++) {
        for (let j = i + 1; j < window.length; j++) {
          maxSpread = Math.max(maxSpread, getAngularDifference(window[i], window[j]));
        }
      }
      const androidJittery = window.length >= JITTER_WINDOW_SIZE && maxSpread > JITTER_THRESHOLD_DEG;
      const iosUncalibrated =
        Number.isFinite(iosAccuracy) && (iosAccuracy! < 0 || iosAccuracy! > IOS_ACCURACY_THRESHOLD_DEG);
      setNeedsCalibration(androidJittery || iosUncalibrated);

      const { value: smoothed, state } = smoothHeading(smootherRef.current, rawHeading);
      smootherRef.current = state;
      const compensated = applyScreenOrientationCompensation(smoothed, screenAngle);

      // Sampled (not every event — deviceorientation can fire dozens of
      // times/sec, which would blow up this array for no added precision)
      // buffer of the final, ready-to-use heading, oldest-first.
      const now = Date.now();
      const buffer = driftBufferRef.current;
      if (buffer.length === 0 || now - buffer[buffer.length - 1].t >= DRIFT_SAMPLE_INTERVAL_MS) {
        buffer.push({ heading: compensated, t: now });
      }
      while (buffer.length > 0 && now - buffer[0].t > DRIFT_WINDOW_MS * 1.5) {
        buffer.shift();
      }
      const driftDeg =
        buffer.length >= 2
          ? computeHeadingDrift(buffer[0].heading, compensated, now - buffer[0].t, DRIFT_WINDOW_MS)
          : null;
      // Precisely the last DRIFT_WINDOW_MS (the buffer itself is kept a bit
      // longer, 1.5x, so computeHeadingDrift always has an anchor point).
      const windowHeadings = buffer.filter((s) => now - s.t <= DRIFT_WINDOW_MS).map((s) => s.heading);

      setHeading(compensated);
      setDebug((prev) => ({
        ...prev,
        alpha: event.alpha,
        webkitCompassHeading: event.webkitCompassHeading,
        webkitCompassAccuracy: iosAccuracy,
        isAbsolute,
        screenAngle,
        rawHeading,
        smoothedHeading: smoothed,
        driftDeg,
        activeEventType,
        firstRawHeadingDeg: firstRawHeadingRef.current,
        userAgentSummary,
        stats: computeHeadingStats(windowHeadings),
        driftCharacter: classifyDriftCharacter(windowHeadings),
        source: 'web',
      }));
    }

    // deviceorientationabsolute is always north-referenced when it fires.
    function handleOrientationAbsolute(event: Event) {
      acceptEvent(event as DeviceOrientationEventWithExtras, true, 'deviceorientationabsolute');
    }

    // Plain deviceorientation is only north-referenced when its own
    // `absolute` flag is true (or webkitCompassHeading is present, which
    // computeHeadingFromOrientationEvent checks first regardless of this
    // flag) — never assume otherwise.
    function handleOrientation(event: DeviceOrientationEvent) {
      const typedEvent = event as DeviceOrientationEventWithExtras;
      acceptEvent(typedEvent, typedEvent.absolute === true, 'deviceorientation');
    }

    window.addEventListener('deviceorientationabsolute', handleOrientationAbsolute);
    window.addEventListener('deviceorientation', handleOrientation);

    const timeoutId = window.setTimeout(() => {
      if (!hasUsableHeadingRef.current) {
        setPermissionState('unsupported');
      }
    }, NO_DATA_TIMEOUT_MS);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientationAbsolute);
      window.removeEventListener('deviceorientation', handleOrientation);
      window.clearTimeout(timeoutId);
    };
  }, [active, isAndroid, permissionState]);

  return { heading, permissionState, requestPermission, needsCalibration, reliability, debug };
}
