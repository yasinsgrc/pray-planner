import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyScreenOrientationCompensation,
  computeHeadingFromOrientationEvent,
  getAngularDifference,
  smoothHeading,
  INITIAL_SMOOTHER_STATE,
  CircularSmootherState,
} from '../utils/compassHeading';

export type CompassPermissionState = 'idle' | 'granted' | 'denied' | 'unsupported';

export interface CompassDebugInfo {
  alpha: number | null;
  webkitCompassHeading: number | undefined;
  webkitCompassAccuracy: number | undefined;
  isAbsolute: boolean;
  screenAngle: number;
  rawHeading: number | null;
  smoothedHeading: number | null;
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

function getScreenAngle(): number {
  return window.screen.orientation?.angle ?? 0;
}

export function useCompassHeading(active: boolean): CompassHeadingState {
  const [heading, setHeading] = useState<number | null>(null);
  const [permissionState, setPermissionState] = useState<CompassPermissionState>('idle');
  const [needsCalibration, setNeedsCalibration] = useState(false);
  const [debug, setDebug] = useState<CompassDebugInfo>({
    alpha: null,
    webkitCompassHeading: undefined,
    webkitCompassAccuracy: undefined,
    isAbsolute: false,
    screenAngle: 0,
    rawHeading: null,
    smoothedHeading: null,
  });
  const hasUsableHeadingRef = useRef(false);
  const smootherRef = useRef<CircularSmootherState>(INITIAL_SMOOTHER_STATE);
  const jitterWindowRef = useRef<number[]>([]);

  const requestPermission = useCallback(async () => {
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

  useEffect(() => {
    if (!active || permissionState !== 'granted') return;

    hasUsableHeadingRef.current = false;
    smootherRef.current = INITIAL_SMOOTHER_STATE;
    jitterWindowRef.current = [];

    function acceptEvent(event: DeviceOrientationEventWithExtras, isAbsolute: boolean) {
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

      setHeading(compensated);
      setDebug({
        alpha: event.alpha,
        webkitCompassHeading: event.webkitCompassHeading,
        webkitCompassAccuracy: iosAccuracy,
        isAbsolute,
        screenAngle,
        rawHeading,
        smoothedHeading: smoothed,
      });
    }

    // deviceorientationabsolute is always north-referenced when it fires.
    function handleOrientationAbsolute(event: Event) {
      acceptEvent(event as DeviceOrientationEventWithExtras, true);
    }

    // Plain deviceorientation is only north-referenced when its own
    // `absolute` flag is true (or webkitCompassHeading is present, which
    // computeHeadingFromOrientationEvent checks first regardless of this
    // flag) — never assume otherwise.
    function handleOrientation(event: DeviceOrientationEvent) {
      const typedEvent = event as DeviceOrientationEventWithExtras;
      acceptEvent(typedEvent, typedEvent.absolute === true);
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
  }, [active, permissionState]);

  return { heading, permissionState, requestPermission, needsCalibration, debug };
}
