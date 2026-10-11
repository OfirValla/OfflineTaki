import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * TurboModule spec for the Android Nearby Connections bridge.
 *
 * This file is the single source of truth for the native API: React Native codegen turns it
 * into the abstract Java class `NativeNearbyConnectionsSpec` that the Kotlin module extends.
 * Keep it dumb. It moves strings and events; it knows nothing about games, lobbies or cards.
 *
 * Events are delivered through `NativeEventEmitter` under the name `NearbyConnectionsEvent`
 * with a `type` discriminator. See `NearbyNativeEvent` in `../NearbyNativeEvents.ts`.
 */

export type NativeCapabilities = {
  /** Google Play Services is installed and up to date enough for Nearby Connections. */
  playServicesAvailable: boolean;
  /** The device has a Bluetooth adapter. */
  bluetoothSupported: boolean;
  /** Practical upper bound on simultaneously connected peers for a host. */
  maxPeers: number;
  /** Largest payload accepted by `sendPayload`, in bytes. */
  maxMessageBytes: number;
};

export type NativeRadioStatus = {
  bluetoothEnabled: boolean;
  locationEnabled: boolean;
  /** True on Android versions where system Location must be on for discovery to work. */
  locationRequired: boolean;
  apiLevel: number;
};

export interface Spec extends TurboModule {
  // Environment
  getCapabilities(): Promise<NativeCapabilities>;
  getRadioStatus(): Promise<NativeRadioStatus>;
  /** Shows the system "turn on Bluetooth" dialog. Resolves true if the user accepted. */
  requestEnableBluetooth(): Promise<boolean>;
  openLocationSettings(): void;
  openAppSettings(): void;

  // Host role
  startAdvertising(endpointName: string, serviceId: string): Promise<void>;
  stopAdvertising(): Promise<void>;

  // Client role
  startDiscovery(serviceId: string): Promise<void>;
  stopDiscovery(): Promise<void>;
  /** Resolves once the connection is fully established (both sides accepted). */
  requestConnection(
    endpointId: string,
    localEndpointName: string,
  ): Promise<void>;

  // Both roles
  disconnectFromEndpoint(endpointId: string): void;
  stopAllEndpoints(): void;
  /** Sends one whole message (UTF-8). Delivery is reliable and ordered per endpoint. */
  sendPayload(endpointId: string, payload: string): Promise<void>;

  // Device housekeeping
  startHostService(title: string, text: string): void;
  stopHostService(): void;
  setKeepScreenOn(enabled: boolean): void;

  // Required by NativeEventEmitter
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>(
  'NativeNearbyConnections',
);
