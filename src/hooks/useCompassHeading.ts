import { useCallback, useEffect, useRef, useState } from 'react';
import { computeHeadingFromOrientationEvent } from '../utils/compassHeading';

export type CompassPermissionState = 'idle' | 'granted' | 'denied' | 'unsupported';

export interface CompassHeadingState {
  heading: number | null;
  permissionState: CompassPermissionState;
  requestPermission: () => Promise<void>;
}

interface DeviceOrientationEventWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

interface DeviceOrientationEventWithAbsolute extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

const NO_DATA_TIMEOUT_MS = 5000;

export function useCompassHeading(active: boolean): CompassHeadingState {
  const [heading, setHeading] = useState<number | null>(null);
  const [permissionState, setPermissionState] = useState<CompassPermissionState>('idle');
  const hasReceivedDataRef = useRef(false);
  const receivingAbsoluteDataRef = useRef(false);

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

    hasReceivedDataRef.current = false;
    receivingAbsoluteDataRef.current = false;

    function acceptEvent(event: DeviceOrientationEventWithAbsolute) {
      const nextHeading = computeHeadingFromOrientationEvent({
        webkitCompassHeading: event.webkitCompassHeading,
        alpha: event.alpha,
      });

      if (nextHeading !== null) {
        hasReceivedDataRef.current = true;
        setHeading(nextHeading);
      }
    }

    // deviceorientationabsolute is always north-referenced when it fires.
    function handleOrientationAbsolute(event: Event) {
      receivingAbsoluteDataRef.current = true;
      acceptEvent(event as DeviceOrientationEventWithAbsolute);
    }

    // Plain deviceorientation is only north-referenced when its own
    // `absolute` flag is true. Once absolute data has started arriving,
    // ignore stale relative-only events so they don't overwrite it.
    function handleOrientation(event: DeviceOrientationEvent) {
      const typedEvent = event as DeviceOrientationEventWithAbsolute;
      const isAbsolute = typedEvent.absolute === true;

      if (receivingAbsoluteDataRef.current && !isAbsolute) {
        return;
      }

      if (isAbsolute) {
        receivingAbsoluteDataRef.current = true;
      }

      acceptEvent(typedEvent);
    }

    window.addEventListener('deviceorientationabsolute', handleOrientationAbsolute);
    window.addEventListener('deviceorientation', handleOrientation);

    const timeoutId = window.setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setPermissionState('unsupported');
      }
    }, NO_DATA_TIMEOUT_MS);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientationAbsolute);
      window.removeEventListener('deviceorientation', handleOrientation);
      window.clearTimeout(timeoutId);
    };
  }, [active, permissionState]);

  return { heading, permissionState, requestPermission };
}
