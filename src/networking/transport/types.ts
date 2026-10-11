import type { Unsubscribe } from '../../utils/Emitter';

/** Transport-scoped identifier of a remote device: a Nearby endpointId, a BLE address, etc. */
export type PeerId = string;

export enum TransportKind {
  NearbyConnections = 'nearby-connections',
  BleGatt = 'ble-gatt',
  Multipeer = 'multipeer',
  Loopback = 'loopback',
  Memory = 'memory',
}

export enum RadioState {
  Ready = 'ready',
  BluetoothOff = 'bluetooth-off',
  LocationOff = 'location-off',
  Unsupported = 'unsupported',
}

/** What a host puts on the air. Must stay small: it travels inside a Bluetooth advertisement. */
export interface GameAdvertisement {
  protocolVersion: number;
  gameId: string;
  gameName: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  requiresJoinCode: boolean;
}

export interface DiscoveredGame extends GameAdvertisement {
  peerId: PeerId;
  transport: TransportKind;
  lastSeenAt: number;
}

export interface TransportCapabilities {
  kind: TransportKind;
  canHost: boolean;
  maxPeers: number;
  maxMessageBytes: number;
}

export type DisconnectReason = 'remote' | 'local' | 'timeout' | 'radio';

export type TransportEvent =
  | { type: 'radioState'; state: RadioState }
  | { type: 'gameFound'; game: DiscoveredGame }
  | { type: 'gameLost'; peerId: PeerId }
  | { type: 'peerConnected'; peerId: PeerId; verificationCode?: string }
  | { type: 'peerDisconnected'; peerId: PeerId; reason: DisconnectReason }
  | { type: 'message'; peerId: PeerId; payload: string }
  | { type: 'error'; code: string; message: string; peerId?: PeerId };

export interface ConnectOptions {
  timeoutMs?: number;
  /** Human-readable name shown to the host while the link is being set up. */
  localName?: string;
}

/**
 * The seam between the game and the radio.
 *
 * Contract:
 * - `send` delivers one whole message; ordering is preserved per peer; fragmentation, if the
 *   medium needs it, happens inside the transport.
 * - Link-level connections are accepted automatically. Who may *join a game* is decided by the
 *   protocol layer on top.
 * - There is no broadcast: the host sends per-player messages, so fan-out lives above.
 */
export interface NearbyTransport {
  readonly capabilities: TransportCapabilities;
  getRadioState(): Promise<RadioState>;

  // host role
  startAdvertising(ad: GameAdvertisement): Promise<void>;
  updateAdvertising(ad: GameAdvertisement): Promise<void>;
  stopAdvertising(): Promise<void>;

  // client role
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  connect(peerId: PeerId, options?: ConnectOptions): Promise<void>;

  // both roles
  send(peerId: PeerId, payload: string): Promise<void>;
  disconnect(peerId: PeerId): Promise<void>;
  shutdown(): Promise<void>;
  subscribe(listener: (event: TransportEvent) => void): Unsubscribe;
}
