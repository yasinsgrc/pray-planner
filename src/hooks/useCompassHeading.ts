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

const NO_DATA_TIMEOUT_MS = 2000;

export function useCompassHeading(active: boolean): CompassHeadingState {
  const [heading, setHeading] = useState<number | null>(null);
  const [permissionState, setPermissionState] = useState<CompassPermissionState>('idle');
  const hasReceivedDataRef = useRef(false);

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

    function handleOrientation(event: DeviceOrientationEvent) {
      const nextHeading = computeHeadingFromOrientationEvent({
        webkitCompassHeading: (event as unknown as { webkitCompassHeading?: number })
          .webkitCompassHeading,
        alpha: event.alpha,
      });

      if (nextHeading !== null) {
        hasReceivedDataRef.current = true;
        setHeading(nextHeading);
      }
    }

    const eventName =
      'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';

    window.addEventListener(eventName, handleOrientation);

    const timeoutId = window.setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setPermissionState('unsupported');
      }
    }, NO_DATA_TIMEOUT_MS);

    return () => {
      window.removeEventListener(eventName, handleOrientation);
      window.clearTimeout(timeoutId);
    };
  }, [active, permissionState]);

  return { heading, permissionState, requestPermission };
}
