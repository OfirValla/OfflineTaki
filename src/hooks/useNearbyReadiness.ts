import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  AndroidDevice,
  hasNearbyPermissions,
  requestNearbyPermissions,
} from '../platform/AndroidDevice';

export type Readiness =
  | { status: 'checking' }
  | { status: 'ready' }
  | { status: 'permissions-needed' }
  | { status: 'permissions-blocked' }
  | { status: 'bluetooth-off' }
  | { status: 'location-off' }
  | { status: 'no-play-services' }
  | { status: 'unsupported' };

export interface ReadinessController {
  readiness: Readiness;
  /** Re-evaluates permissions and radios. */
  refresh(): Promise<void>;
  /** Performs the one action that resolves the current problem, if there is one. */
  fix(): Promise<void>;
  /** True when the current problem can be fixed from inside the app. */
  canFix: boolean;
}

/**
 * Tells the UI whether Create/Join can work right now and how to get there. Re-checks whenever
 * the app returns to the foreground or the user toggles Bluetooth / Location.
 */
export function useNearbyReadiness(): ReadinessController {
  const [readiness, setReadiness] = useState<Readiness>({ status: 'checking' });
  const blockedRef = useRef(false);

  const refresh = useCallback(async () => {
    const capabilities = await AndroidDevice.getCapabilities();
    if (!capabilities.bluetoothSupported)
      return setReadiness({ status: 'unsupported' });
    if (!capabilities.playServicesAvailable)
      return setReadiness({ status: 'no-play-services' });

    if (!(await hasNearbyPermissions())) {
      return setReadiness({
        status: blockedRef.current
          ? 'permissions-blocked'
          : 'permissions-needed',
      });
    }

    const radio = await AndroidDevice.getRadioStatus();
    if (!radio.bluetoothEnabled)
      return setReadiness({ status: 'bluetooth-off' });
    if (radio.locationRequired && !radio.locationEnabled)
      return setReadiness({ status: 'location-off' });
    setReadiness({ status: 'ready' });
  }, []);

  const fix = useCallback(async () => {
    switch (readiness.status) {
      case 'permissions-needed': {
        const outcome = await requestNearbyPermissions();
        blockedRef.current = outcome === 'blocked';
        break;
      }
      case 'permissions-blocked':
        AndroidDevice.openAppSettings();
        return;
      case 'bluetooth-off':
        await AndroidDevice.requestEnableBluetooth().catch(() => false);
        break;
      case 'location-off':
        AndroidDevice.openLocationSettings();
        return;
      default:
        return;
    }
    await refresh();
  }, [readiness.status, refresh]);

  useEffect(() => {
    void refresh();
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    const unsubscribeRadio = AndroidDevice.subscribeRadioStatus(
      () => void refresh(),
    );
    return () => {
      appState.remove();
      unsubscribeRadio();
    };
  }, [refresh]);

  const canFix =
    readiness.status === 'permissions-needed' ||
    readiness.status === 'permissions-blocked' ||
    readiness.status === 'bluetooth-off' ||
    readiness.status === 'location-off';

  return { readiness, refresh, fix, canFix };
}
