import {
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
  type Permission,
} from 'react-native';
import NativeNearbyConnections, {
  type NativeCapabilities,
  type NativeRadioStatus,
} from '../native/specs/NativeNearbyConnections';
import {
  NEARBY_EVENT_NAME,
  type NearbyNativeEvent,
  type NearbyRadioStatusEvent,
} from '../native/NearbyNativeEvents';

/**
 * Device-level concerns that are not networking: runtime permissions, radio toggles, settings
 * deep links, the host foreground service and keep-awake. UI code talks to this, never to the
 * native module directly.
 */

export type PermissionOutcome = 'granted' | 'denied' | 'blocked';

const P = PermissionsAndroid.PERMISSIONS;

/** Permissions Nearby Connections needs at runtime, by Android API level. */
export function nearbyPermissionsFor(sdk: number): Permission[] {
  if (sdk >= 33) {
    return [
      P.BLUETOOTH_SCAN,
      P.BLUETOOTH_ADVERTISE,
      P.BLUETOOTH_CONNECT,
      P.NEARBY_WIFI_DEVICES,
    ];
  }
  if (sdk >= 31) {
    return [
      P.BLUETOOTH_SCAN,
      P.BLUETOOTH_ADVERTISE,
      P.BLUETOOTH_CONNECT,
      P.ACCESS_FINE_LOCATION,
    ];
  }
  return [P.ACCESS_FINE_LOCATION];
}

function apiLevel(): number {
  return typeof Platform.Version === 'number'
    ? Platform.Version
    : parseInt(String(Platform.Version), 10);
}

export async function hasNearbyPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const results = await Promise.all(
    nearbyPermissionsFor(apiLevel()).map(p => PermissionsAndroid.check(p)),
  );
  return results.every(Boolean);
}

export async function requestNearbyPermissions(): Promise<PermissionOutcome> {
  if (Platform.OS !== 'android') return 'granted';
  const statuses = await PermissionsAndroid.requestMultiple(
    nearbyPermissionsFor(apiLevel()),
  );
  const values = Object.values(statuses);
  if (values.every(s => s === PermissionsAndroid.RESULTS.GRANTED))
    return 'granted';
  if (values.some(s => s === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN))
    return 'blocked';
  return 'denied';
}

/** Best effort: lets the "Hosting" notification show on Android 13+. Not required to host. */
export async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || apiLevel() < 33) return;
  await PermissionsAndroid.request(P.POST_NOTIFICATIONS).catch(() => undefined);
}

const nativeEvents = new NativeEventEmitter(NativeNearbyConnections);

export const AndroidDevice = {
  getCapabilities(): Promise<NativeCapabilities> {
    return NativeNearbyConnections.getCapabilities();
  },
  getRadioStatus(): Promise<NativeRadioStatus> {
    return NativeNearbyConnections.getRadioStatus();
  },
  requestEnableBluetooth(): Promise<boolean> {
    return NativeNearbyConnections.requestEnableBluetooth();
  },
  openLocationSettings(): void {
    NativeNearbyConnections.openLocationSettings();
  },
  openAppSettings(): void {
    NativeNearbyConnections.openAppSettings();
  },
  startHostService(title: string, text: string): void {
    NativeNearbyConnections.startHostService(title, text);
  },
  stopHostService(): void {
    NativeNearbyConnections.stopHostService();
  },
  setKeepScreenOn(enabled: boolean): void {
    NativeNearbyConnections.setKeepScreenOn(enabled);
  },
  subscribeRadioStatus(
    listener: (status: NearbyRadioStatusEvent) => void,
  ): () => void {
    const subscription = nativeEvents.addListener(
      NEARBY_EVENT_NAME,
      (raw: Object) => {
        const event = raw as NearbyNativeEvent;
        if (event.type === 'radioStatus') listener(event);
      },
    );
    return () => subscription.remove();
  },
};
