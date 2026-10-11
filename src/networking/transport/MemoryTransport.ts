import { Emitter, type Unsubscribe } from '../../utils/Emitter';
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

/**
 * In-process network for tests: several MemoryTransports share one MemoryNetwork. Peer ids are
 * the other node's id. Delivery is asynchronous and ordered per link, with optional latency,
 * loss and duplication so that the protocol layer can be tested against a misbehaving radio.
 */

export interface MemoryFaults {
  latencyMs?: number;
  /** 0..1 probability that a message is silently dropped. */
  dropRate?: number;
  /** 0..1 probability that a message is delivered twice. */
  duplicateRate?: number;
}

export class MemoryNetwork {
  private readonly nodes = new Map<string, MemoryTransport>();
  private readonly advertisements = new Map<string, GameAdvertisement>();
  private readonly discovering = new Set<string>();
  private readonly links = new Set<string>();
  private pendingDeliveries = 0;
  private faults: MemoryFaults = {};
  /** Targeted loss for tests: how many upcoming messages to drop per directed link. */
  private readonly dropsPending = new Map<string, number>();
  private random: () => number = Math.random;

  createTransport(
    nodeId: string,
    options: { canHost?: boolean } = {},
  ): MemoryTransport {
    if (this.nodes.has(nodeId))
      throw new Error(`Node ${nodeId} already exists`);
    const transport = new MemoryTransport(
      nodeId,
      this,
      options.canHost ?? true,
    );
    this.nodes.set(nodeId, transport);
    return transport;
  }

  setFaults(faults: MemoryFaults, random: () => number = Math.random): void {
    this.faults = faults;
    this.random = random;
  }

  /** Resolves once every scheduled delivery has happened. */
  async flush(): Promise<void> {
    const wait = (this.faults.latencyMs ?? 0) + 1;
    while (this.pendingDeliveries > 0) {
      await new Promise<void>(resolve => setTimeout(() => resolve(), wait));
    }
    // One more tick so that listeners reacting to the last delivery have run.
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
  }

  isAdvertising(nodeId: string): boolean {
    return this.advertisements.has(nodeId);
  }

  isConnected(a: string, b: string): boolean {
    return this.links.has(linkKey(a, b));
  }

  /** Simulates the radio dropping a link; both ends see a remote disconnect. */
  breakLink(a: string, b: string): void {
    if (!this.links.delete(linkKey(a, b))) return;
    this.nodes
      .get(a)
      ?.receiveEvent({ type: 'peerDisconnected', peerId: b, reason: 'radio' });
    this.nodes
      .get(b)
      ?.receiveEvent({ type: 'peerDisconnected', peerId: a, reason: 'radio' });
  }

  // --- called by MemoryTransport ---------------------------------------------------------

  advertise(nodeId: string, ad: GameAdvertisement): void {
    this.advertisements.set(nodeId, ad);
    for (const other of this.discovering) {
      if (other !== nodeId)
        this.nodes.get(other)?.receiveEvent(this.foundEvent(nodeId, ad));
    }
  }

  stopAdvertising(nodeId: string): void {
    if (!this.advertisements.delete(nodeId)) return;
    for (const other of this.discovering) {
      if (other !== nodeId)
        this.nodes
          .get(other)
          ?.receiveEvent({ type: 'gameLost', peerId: nodeId });
    }
  }

  startDiscovery(nodeId: string): void {
    this.discovering.add(nodeId);
    for (const [hostId, ad] of this.advertisements) {
      if (hostId !== nodeId)
        this.nodes.get(nodeId)?.receiveEvent(this.foundEvent(hostId, ad));
    }
  }

  stopDiscovery(nodeId: string): void {
    this.discovering.delete(nodeId);
  }

  connect(fromId: string, toId: string): void {
    const target = this.nodes.get(toId);
    if (!target) throw new Error(`Unknown peer ${toId}`);
    if (!this.advertisements.has(toId))
      throw new Error(`Peer ${toId} is not accepting connections`);
    const key = linkKey(fromId, toId);
    if (this.links.has(key)) return;
    this.links.add(key);
    this.nodes.get(fromId)?.receiveEvent({
      type: 'peerConnected',
      peerId: toId,
      verificationCode: '0000',
    });
    target.receiveEvent({
      type: 'peerConnected',
      peerId: fromId,
      verificationCode: '0000',
    });
  }

  /**
   * Orderly disconnect: queued behind messages already in flight, like a TCP FIN after data,
   * so a REJECTED sent just before the disconnect still arrives. `breakLink` is the abrupt one.
   */
  disconnect(fromId: string, toId: string): void {
    const key = linkKey(fromId, toId);
    if (!this.links.has(key)) return;
    this.pendingDeliveries++;
    setTimeout(() => {
      this.pendingDeliveries--;
      if (!this.links.delete(key)) return;
      this.nodes.get(fromId)?.receiveEvent({
        type: 'peerDisconnected',
        peerId: toId,
        reason: 'local',
      });
      this.nodes.get(toId)?.receiveEvent({
        type: 'peerDisconnected',
        peerId: fromId,
        reason: 'remote',
      });
    }, this.faults.latencyMs ?? 0);
  }

  disconnectAll(nodeId: string): void {
    for (const key of Array.from(this.links)) {
      const [a, b] = key.split('::');
      if (a === nodeId) this.disconnect(a, b);
      else if (b === nodeId) this.disconnect(b, a);
    }
  }

  /** Drops the next `count` messages sent from `fromId` to `toId`. */
  dropNext(fromId: string, toId: string, count = 1): void {
    this.dropsPending.set(`${fromId}->${toId}`, count);
  }

  send(fromId: string, toId: string, payload: string): void {
    const dropKey = `${fromId}->${toId}`;
    const drops = this.dropsPending.get(dropKey) ?? 0;
    if (drops > 0) {
      this.dropsPending.set(dropKey, drops - 1);
      return;
    }
    if (!this.links.has(linkKey(fromId, toId)))
      throw new Error(`${fromId} is not connected to ${toId}`);
    const copies = this.random() < (this.faults.duplicateRate ?? 0) ? 2 : 1;
    for (let i = 0; i < copies; i++) {
      if (this.random() < (this.faults.dropRate ?? 0)) continue;
      this.pendingDeliveries++;
      setTimeout(() => {
        this.pendingDeliveries--;
        if (this.links.has(linkKey(fromId, toId))) {
          this.nodes
            .get(toId)
            ?.receiveEvent({ type: 'message', peerId: fromId, payload });
        }
      }, this.faults.latencyMs ?? 0);
    }
  }

  private foundEvent(hostId: string, ad: GameAdvertisement): TransportEvent {
    return {
      type: 'gameFound',
      game: {
        ...ad,
        peerId: hostId,
        transport: TransportKind.Memory,
        lastSeenAt: Date.now(),
      },
    };
  }
}

export class MemoryTransport implements NearbyTransport {
  readonly capabilities: TransportCapabilities;
  private readonly events = new Emitter<TransportEvent>();
  private radioState = RadioState.Ready;
  private alive = true;

  constructor(
    readonly nodeId: string,
    private readonly network: MemoryNetwork,
    canHost: boolean,
  ) {
    this.capabilities = {
      kind: TransportKind.Memory,
      canHost,
      maxPeers: 7,
      maxMessageBytes: 32768,
    };
  }

  /** Test hook: flips the simulated radio. */
  setRadioState(state: RadioState): void {
    this.radioState = state;
    this.events.emit({ type: 'radioState', state });
  }

  receiveEvent(event: TransportEvent): void {
    if (!this.alive) return;
    this.events.emit(event);
  }

  async getRadioState(): Promise<RadioState> {
    return this.radioState;
  }

  async startAdvertising(ad: GameAdvertisement): Promise<void> {
    if (!this.capabilities.canHost) throw new Error('This node cannot host');
    this.network.advertise(this.nodeId, ad);
  }

  async updateAdvertising(ad: GameAdvertisement): Promise<void> {
    this.network.advertise(this.nodeId, ad);
  }

  async stopAdvertising(): Promise<void> {
    this.network.stopAdvertising(this.nodeId);
  }

  async startDiscovery(): Promise<void> {
    this.network.startDiscovery(this.nodeId);
  }

  async stopDiscovery(): Promise<void> {
    this.network.stopDiscovery(this.nodeId);
  }

  async connect(peerId: PeerId, _options?: ConnectOptions): Promise<void> {
    this.network.connect(this.nodeId, peerId);
  }

  async send(peerId: PeerId, payload: string): Promise<void> {
    this.network.send(this.nodeId, peerId, payload);
  }

  async disconnect(peerId: PeerId): Promise<void> {
    this.network.disconnect(this.nodeId, peerId);
  }

  async shutdown(): Promise<void> {
    this.network.stopAdvertising(this.nodeId);
    this.network.stopDiscovery(this.nodeId);
    this.network.disconnectAll(this.nodeId);
    this.alive = false;
    this.events.clear();
  }

  subscribe(listener: (event: TransportEvent) => void): Unsubscribe {
    return this.events.subscribe(listener);
  }
}

function linkKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}
