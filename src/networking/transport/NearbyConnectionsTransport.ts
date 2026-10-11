import { NativeEventEmitter, type EmitterSubscription } from 'react-native';
import NativeNearbyConnections, {
  type Spec as NearbyNative,
} from '../../native/specs/NativeNearbyConnections';
import {
  NEARBY_EVENT_NAME,
  type NearbyNativeEvent,
} from '../../native/NearbyNativeEvents';
import { Emitter, type Unsubscribe } from '../../utils/Emitter';
import { createLogger } from '../../utils/logger';
import { decodeAdvertisement, encodeAdvertisement } from './AdvertisementCodec';
import {
  RadioState,
  TransportKind,
  type ConnectOptions,
  type GameAdvertisement,
  type NearbyTransport,
  type PeerId,
  type TransportCapabilities,
  type TransportEvent,
} from './types';

/** Only app instances advertising this id can see each other. Bump the suffix on breaking changes. */
export const NEARBY_SERVICE_ID = 'global.ultra.offlinetaki.v1';

const DEFAULT_CONNECT_TIMEOUT_MS = 20_000;
const log = createLogger('NearbyTransport');

/**
 * Android implementation of NearbyTransport over Google Nearby Connections.
 * Everything Nearby-specific (endpoint names, status codes, event shapes) stops here.
 */
export class NearbyConnectionsTransport implements NearbyTransport {
  readonly capabilities: TransportCapabilities = {
    kind: TransportKind.NearbyConnections,
    canHost: true,
    maxPeers: 7,
    maxMessageBytes: 32_768,
  };

  private readonly events = new Emitter<TransportEvent>();
  private readonly nativeEvents: NativeEventEmitter;
  private nativeSubscription: EmitterSubscription | null;
  private readonly linkInfo = new Map<
    PeerId,
    { peerName: string; verificationCode: string }
  >();
  private readonly connected = new Set<PeerId>();
  private localName = 'Player';

  constructor(
    private readonly native: NearbyNative = NativeNearbyConnections,
    private readonly serviceId: string = NEARBY_SERVICE_ID,
  ) {
    this.nativeEvents = new NativeEventEmitter(native);
    this.nativeSubscription = this.nativeEvents.addListener(
      NEARBY_EVENT_NAME,
      (event: Object) => this.handleNativeEvent(event as NearbyNativeEvent),
    );
  }

  /** Name shown to a host while a link is being negotiated. */
  setLocalName(name: string): void {
    this.localName = name.trim() || 'Player';
  }

  async getRadioState(): Promise<RadioState> {
    const capabilities = await this.native.getCapabilities();
    if (
      !capabilities.bluetoothSupported ||
      !capabilities.playServicesAvailable
    ) {
      return RadioState.Unsupported;
    }
    const status = await this.native.getRadioStatus();
    return toRadioState(status);
  }

  async startAdvertising(ad: GameAdvertisement): Promise<void> {
    await this.native.startAdvertising(encodeAdvertisement(ad), this.serviceId);
  }

  async updateAdvertising(ad: GameAdvertisement): Promise<void> {
    // Nearby has no in-place update; a stop/start pair is the supported way.
    await this.native.stopAdvertising();
    await this.native.startAdvertising(encodeAdvertisement(ad), this.serviceId);
  }

  async stopAdvertising(): Promise<void> {
    await this.native.stopAdvertising();
  }

  async startDiscovery(): Promise<void> {
    await this.native.startDiscovery(this.serviceId);
  }

  async stopDiscovery(): Promise<void> {
    await this.native.stopDiscovery();
  }

  async connect(peerId: PeerId, options: ConnectOptions = {}): Promise<void> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    const localName = options.localName ?? this.localName;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.native.disconnectFromEndpoint(peerId);
        reject(
          new Error(`Connection to ${peerId} timed out after ${timeoutMs} ms`),
        );
      }, timeoutMs);
    });
    try {
      await Promise.race([
        this.native.requestConnection(peerId, localName),
        timeout,
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async send(peerId: PeerId, payload: string): Promise<void> {
    await this.native.sendPayload(peerId, payload);
  }

  async disconnect(peerId: PeerId): Promise<void> {
    this.native.disconnectFromEndpoint(peerId);
  }

  async shutdown(): Promise<void> {
    await this.native.stopAdvertising().catch(() => undefined);
    await this.native.stopDiscovery().catch(() => undefined);
    this.native.stopAllEndpoints();
    this.nativeSubscription?.remove();
    this.nativeSubscription = null;
    this.connected.clear();
    this.linkInfo.clear();
    this.events.clear();
  }

  subscribe(listener: (event: TransportEvent) => void): Unsubscribe {
    return this.events.subscribe(listener);
  }

  private handleNativeEvent(event: NearbyNativeEvent): void {
    switch (event.type) {
      case 'radioStatus':
        this.events.emit({ type: 'radioState', state: toRadioState(event) });
        return;
      case 'endpointFound': {
        const ad = decodeAdvertisement(event.endpointName);
        if (!ad) {
          log.debug(
            'Ignoring endpoint with unreadable advertisement',
            event.endpointName,
          );
          return;
        }
        this.events.emit({
          type: 'gameFound',
          game: {
            ...ad,
            peerId: event.peerId,
            transport: TransportKind.NearbyConnections,
            lastSeenAt: Date.now(),
          },
        });
        return;
      }
      case 'endpointLost':
        this.events.emit({ type: 'gameLost', peerId: event.peerId });
        return;
      case 'connectionInitiated':
        this.linkInfo.set(event.peerId, {
          peerName: event.peerName,
          verificationCode: event.verificationCode,
        });
        return;
      case 'peerConnected':
        this.connected.add(event.peerId);
        this.events.emit({
          type: 'peerConnected',
          peerId: event.peerId,
          verificationCode: this.linkInfo.get(event.peerId)?.verificationCode,
        });
        return;
      case 'connectionFailed':
        this.linkInfo.delete(event.peerId);
        this.events.emit({
          type: 'error',
          code: `NEARBY_${event.statusCode}`,
          message: `Connection failed: ${event.statusMessage}`,
          peerId: event.peerId,
        });
        return;
      case 'peerDisconnected':
        this.connected.delete(event.peerId);
        this.linkInfo.delete(event.peerId);
        this.events.emit({
          type: 'peerDisconnected',
          peerId: event.peerId,
          reason: event.reason,
        });
        return;
      case 'message':
        this.events.emit({
          type: 'message',
          peerId: event.peerId,
          payload: event.payload,
        });
        return;
    }
  }
}

function toRadioState(status: {
  bluetoothEnabled: boolean;
  locationEnabled: boolean;
  locationRequired: boolean;
}): RadioState {
  if (!status.bluetoothEnabled) return RadioState.BluetoothOff;
  if (status.locationRequired && !status.locationEnabled)
    return RadioState.LocationOff;
  return RadioState.Ready;
}
