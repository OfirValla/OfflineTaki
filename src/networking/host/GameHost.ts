import {
  createGame,
  currentPlayerId,
  legalMoves as engineLegalMoves,
  projectForPlayer,
  redactEvent,
  reduce,
  type GameAction,
  type GameState,
  type RuleSet,
} from '../../game';
import { err, ok, type Result } from '../../utils/Result';
import { shortId, uuid } from '../../utils/ids';
import { createLogger } from '../../utils/logger';
import {
  LobbyPhase,
  MessageType,
  PROTOCOL_VERSION,
  PlayerKind,
  RejectReason,
  clampSeatCount,
  DEFAULT_SEATS,
  type Message,
  type MessageOf,
  type PayloadOf,
  type PeerInfo,
} from '../protocol';
import { delay, SessionCore } from '../session/SessionCore';
import type {
  HostSession,
  SessionPeer,
  SessionState,
} from '../session/SessionState';
import type {
  GameAdvertisement,
  NearbyTransport,
  PeerId,
  TransportEvent,
} from '../transport/types';
import { BotScheduler } from './bots/BotScheduler';
import { HeuristicStrategy, type BotStrategy } from './bots/BotStrategy';
import { EventLog } from './EventLog';

export interface GameHostOptions {
  self: { playerId: string; name: string };
  appVersion: string;
  gameId?: string;
  gameName?: string;
  seatCount?: number;
  rules?: Partial<RuleSet>;
  /** Seed source for each new deal. Defaults to a random 32-bit value. */
  seed?: () => number;
  botStrategy?: BotStrategy;
  /** Bot thinking time. Defaults to 0.7–1.3 s. */
  botDelayMs?: () => number;
  /** How long to wait after sending REJECTED before dropping the link. */
  rejectDisconnectDelayMs?: number;
  eventLogCapacity?: number;
  now?: () => number;
}

/** Why an action was refused: an engine rule, or a host-level condition such as no game running. */
export interface ActionFailure {
  code: string;
  message: string;
}

const DEFAULT_REJECT_DISCONNECT_DELAY_MS = 250;
const RECENT_ACTIONS_PER_PLAYER = 50;
const log = createLogger('GameHost');

/**
 * The authoritative side. Owns the lobby, the engine state, the bots and every player's view.
 * Clients only ever send actions; everything they see comes from here.
 */
export class GameHost extends SessionCore implements HostSession {
  private engine: GameState | null = null;
  private readonly eventLog: EventLog;
  private readonly bots: BotScheduler;
  private readonly seed: () => number;
  private readonly rules: Partial<RuleSet>;
  private readonly appVersion: string;
  private readonly rejectDisconnectDelayMs: number;
  /** Links that are up but have not said HELLO yet. */
  private readonly pendingLinks = new Map<
    PeerId,
    { verificationCode?: string }
  >();
  /** Reconnect secrets per human seat. */
  private readonly tokens = new Map<string, string>();
  /** Outcome of recently applied actions, so a retried action is not applied twice. */
  private readonly recentActions = new Map<
    string,
    Map<string, Result<void, ActionFailure>>
  >();
  private closed = false;
  /** Test hook: how many bot actions the engine refused (should stay 0). */
  botFailures = 0;

  constructor(transport: NearbyTransport, options: GameHostOptions) {
    const now = options.now ?? Date.now;
    const self: PeerInfo = {
      playerId: options.self.playerId,
      name: options.self.name,
      isHost: true,
      kind: PlayerKind.Human,
      connected: true,
    };
    const initial: SessionState = {
      role: 'host',
      status: 'idle',
      gameId: options.gameId ?? uuid(),
      gameName: options.gameName ?? `${options.self.name}'s Game`,
      hostName: options.self.name,
      self,
      phase: LobbyPhase.Lobby,
      seatCount: clampSeatCount(options.seatCount ?? DEFAULT_SEATS),
      peers: [],
      messages: [],
      game: null,
      lastRejection: null,
      pendingActionId: null,
      reconnectToken: null,
    };
    super(transport, initial, now);
    this.appVersion = options.appVersion;
    this.rules = options.rules ?? {};
    this.seed = options.seed ?? (() => Math.floor(Math.random() * 0xffffffff));
    this.rejectDisconnectDelayMs =
      options.rejectDisconnectDelayMs ?? DEFAULT_REJECT_DISCONNECT_DELAY_MS;
    this.eventLog = new EventLog(options.eventLogCapacity);
    this.bots = new BotScheduler({
      strategy: options.botStrategy ?? new HeuristicStrategy(),
      delayMs: options.botDelayMs ?? (() => 700 + Math.random() * 600),
      act: (botId, action) => {
        const result = this.applyAction(botId, `bot-${shortId()}`, action);
        if (!result.ok) {
          this.botFailures++;
          log.warn(
            'Bot action rejected',
            botId,
            result.error.code,
            result.error.message,
          );
        }
      },
    });
  }

  // ---------------------------------------------------------------------------------------
  // Lobby
  // ---------------------------------------------------------------------------------------

  async startHosting(): Promise<void> {
    await this.transport.startAdvertising(this.advertisement());
    this.update({ status: 'hosting' });
    this.addSystemMessage('Waiting for players nearby…');
  }

  async setSeatCount(requested: number): Promise<number> {
    if (this.state.phase !== LobbyPhase.Lobby) {
      throw new Error('Seats cannot change after the game has started');
    }
    const seatCount = clampSeatCount(requested, this.humanCount());
    if (seatCount === this.state.seatCount) return seatCount;
    this.update({ seatCount });
    await this.refreshAdvertising();
    await this.broadcastLobbyState();
    return seatCount;
  }

  async startGame(): Promise<void> {
    if (this.state.phase === LobbyPhase.Lobby) {
      const bots = createBots(this.openSeats());
      this.update({
        phase: LobbyPhase.Started,
        peers: [...this.state.peers, ...bots],
      });
      await this.transport
        .stopAdvertising()
        .catch(e => log.warn('stopAdvertising', e));
      this.addSystemMessage(describeStart(bots.length));
      this.emitEvent({ type: 'gameStarted' });
      await this.broadcastLobbyState();
    } else if (this.engine && this.engine.phase.kind === 'Finished') {
      this.addSystemMessage('New round');
    } else {
      return; // a game is in progress
    }
    this.deal();
    await this.sendSnapshotToAll();
    this.considerBots();
  }

  // ---------------------------------------------------------------------------------------
  // Both
  // ---------------------------------------------------------------------------------------

  async sendChat(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.appendMessage(
      this.chatEntryFrom(
        uuid(),
        this.state.self.playerId,
        this.state.self.name,
        trimmed,
      ),
    );
    await this.relay(
      MessageType.Chat,
      { text: trimmed, senderName: this.state.self.name },
      this.state.self.playerId,
      null,
    );
  }

  async act(action: GameAction): Promise<void> {
    const actionId = uuid();
    this.update({ pendingActionId: actionId });
    const result = this.applyAction(this.state.self.playerId, actionId, action);
    if (!result.ok)
      this.emitEvent({ type: 'actionRejected', code: result.error.code });
    this.update({
      pendingActionId: null,
      lastRejection: result.ok
        ? null
        : {
            actionId,
            code: result.error.code,
            message: result.error.message,
            at: this.now(),
          },
    });
  }

  async leave(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.bots.cancel();
    this.stopListening();
    await this.transport.stopAdvertising().catch(() => undefined);
    for (const peerId of this.connectedPeerIds()) {
      await this.transport.disconnect(peerId).catch(() => undefined);
    }
    for (const peerId of this.pendingLinks.keys()) {
      await this.transport.disconnect(peerId).catch(() => undefined);
    }
    this.update({ status: 'closed' });
  }

  /** Test hook: the full engine state. Never exposed to the UI. */
  engineStateForTesting(): GameState | null {
    return this.engine;
  }

  /** Test hook: resolves when no bot turn is queued. */
  botsPending(): boolean {
    return this.bots.pending;
  }

  botsIdle(): Promise<void> {
    return this.bots.settle();
  }

  // ---------------------------------------------------------------------------------------
  // Engine
  // ---------------------------------------------------------------------------------------

  private deal(): void {
    const roster = [this.state.self, ...this.state.peers].map(p => ({
      id: p.playerId,
      name: p.name,
    }));
    const { state, events } = createGame({
      gameId: this.state.gameId,
      players: roster,
      seed: this.seed(),
      rules: this.rules,
    });
    // Versions keep climbing across rounds so a new deal's snapshot is never mistaken for a stale one.
    const base = this.eventLog.latestVersion;
    this.engine = { ...state, version: base + events.length };
    this.eventLog.reset(this.engine.version);
    for (const event of events) {
      this.emitEvent({
        type: 'game',
        event: redactEvent(event, this.state.self.playerId),
      });
    }
    this.recentActions.clear();
    this.update({
      game: projectForPlayer(this.engine, this.state.self.playerId),
      lastRejection: null,
    });
  }

  private applyAction(
    playerId: string,
    actionId: string,
    action: GameAction,
  ): Result<void, ActionFailure> {
    const recent = this.recentFor(playerId);
    const seen = recent.get(actionId);
    if (seen) return seen;

    if (!this.engine) {
      return this.remember(
        recent,
        actionId,
        err({ code: 'NO_GAME', message: 'The game has not started' }),
      );
    }
    const result = reduce(this.engine, playerId, action);
    if (!result.ok) return this.remember(recent, actionId, err(result.error));

    this.engine = result.value.state;
    const versioned = this.eventLog.append(result.value.events);
    for (const { event } of versioned) {
      this.emitEvent({
        type: 'game',
        event: redactEvent(event, this.state.self.playerId),
      });
    }
    for (const peer of this.state.peers) {
      if (peer.kind !== PlayerKind.Human || !peer.peerId || !peer.connected)
        continue;
      for (const { version, event } of versioned) {
        void this.sendTo(peer.peerId, MessageType.GameEvent, {
          version,
          event: redactEvent(event, peer.playerId),
        });
      }
    }
    this.update({
      game: projectForPlayer(this.engine, this.state.self.playerId),
    });
    this.considerBots();
    return this.remember(recent, actionId, ok(undefined));
  }

  private considerBots(): void {
    const engine = this.engine;
    if (!engine || engine.phase.kind === 'Finished' || this.closed) {
      this.bots.consider(null);
      return;
    }
    const botId = currentPlayerId(engine);
    const isBot = this.state.peers.some(
      p => p.playerId === botId && p.kind === PlayerKind.Bot,
    );
    if (!isBot) {
      this.bots.consider(null);
      return;
    }
    this.bots.consider({
      botId,
      view: projectForPlayer(engine, botId),
      moves: engineLegalMoves(engine, botId),
    });
  }

  private recentFor(
    playerId: string,
  ): Map<string, Result<void, ActionFailure>> {
    let recent = this.recentActions.get(playerId);
    if (!recent) {
      recent = new Map();
      this.recentActions.set(playerId, recent);
    }
    return recent;
  }

  private remember(
    recent: Map<string, Result<void, ActionFailure>>,
    actionId: string,
    result: Result<void, ActionFailure>,
  ): Result<void, ActionFailure> {
    recent.set(actionId, result);
    if (recent.size > RECENT_ACTIONS_PER_PLAYER) {
      const oldest = recent.keys().next().value;
      if (oldest !== undefined) recent.delete(oldest);
    }
    return result;
  }

  // ---------------------------------------------------------------------------------------
  // Transport events
  // ---------------------------------------------------------------------------------------

  protected handleTransportEvent(event: TransportEvent): void {
    switch (event.type) {
      case 'peerConnected':
        this.pendingLinks.set(event.peerId, {
          verificationCode: event.verificationCode,
        });
        return;
      case 'peerDisconnected':
        this.handlePeerDisconnected(event.peerId);
        return;
      case 'message':
        this.handleRawMessage(event.peerId, event.payload);
        return;
      case 'error':
        log.warn('Transport error', event.code, event.message);
        return;
      default:
        return;
    }
  }

  private handlePeerDisconnected(peerId: PeerId): void {
    this.pendingLinks.delete(peerId);
    const peer = this.state.peers.find(p => p.peerId === peerId);
    if (!peer) return;

    if (this.state.phase === LobbyPhase.Lobby) {
      this.update({ peers: this.state.peers.filter(p => p.peerId !== peerId) });
      this.addSystemMessage(`${peer.name} left`);
      void this.broadcastLobbyState();
      void this.refreshAdvertising();
      return;
    }
    // Mid-game: keep the seat (and the cards) so the player can come back.
    this.update({
      peers: this.state.peers.map(p =>
        p.peerId === peerId
          ? {
              ...p,
              peerId: undefined,
              verificationCode: undefined,
              connected: false,
            }
          : p,
      ),
    });
    this.addSystemMessage(`${peer.name} lost connection`);
    void this.broadcastLobbyState();
    // Become discoverable again so the dropped phone can find us and reclaim its seat.
    void this.transport
      .startAdvertising(this.advertisement())
      .catch(e => log.warn('re-advertise', e));
  }

  protected handleMessage(peerId: PeerId, message: Message): void {
    const knownPeer = this.state.peers.find(p => p.peerId === peerId);

    if (message.t === MessageType.Hello) {
      if (knownPeer) return; // duplicate HELLO on a live link
      void this.handleHello(peerId, message);
      return;
    }
    if (!knownPeer) {
      log.warn(
        'Ignoring message from peer that has not joined',
        peerId,
        message.t,
      );
      return;
    }
    if (message.gid !== this.state.gameId) return;

    switch (message.t) {
      case MessageType.Chat:
        this.appendMessage(
          this.chatEntryFrom(
            message.id,
            message.from,
            message.p.senderName,
            message.p.text,
          ),
        );
        void this.relay(MessageType.Chat, message.p, message.from, peerId);
        return;
      case MessageType.Ping:
        void this.sendTo(peerId, MessageType.Pong, { nonce: message.p.nonce });
        return;
      case MessageType.GameAction: {
        const result = this.applyAction(
          knownPeer.playerId,
          message.p.actionId,
          message.p.action,
        );
        if (!result.ok) {
          void this.sendTo(peerId, MessageType.ActionRejected, {
            actionId: message.p.actionId,
            code: result.error.code,
            message: result.error.message,
          });
        }
        return;
      }
      case MessageType.ResyncRequest:
        void this.resync(knownPeer, message.p.knownVersion);
        return;
      default:
        return;
    }
  }

  private async handleHello(
    peerId: PeerId,
    message: MessageOf<MessageType.Hello>,
  ): Promise<void> {
    if (this.state.status !== 'hosting') {
      await this.reject(
        peerId,
        RejectReason.NotHosting,
        'This phone is not hosting right now.',
      );
      return;
    }
    if (message.p.protocolVersion !== PROTOCOL_VERSION) {
      await this.reject(
        peerId,
        RejectReason.VersionMismatch,
        'Both phones need the same app version.',
      );
      return;
    }

    const reconnect = message.p.reconnect;
    if (reconnect) {
      const seat = this.state.peers.find(
        p => p.playerId === reconnect.playerId && p.kind === PlayerKind.Human,
      );
      if (seat) {
        if (this.tokens.get(seat.playerId) !== reconnect.token) {
          await this.reject(
            peerId,
            RejectReason.BadReconnect,
            'That seat belongs to someone else.',
          );
          return;
        }
        await this.rebind(seat, peerId, message.p.playerName);
        return;
      }
      // Unknown seat (they left a lobby, or the host restarted): fall through to a fresh join.
    }

    if (this.state.phase !== LobbyPhase.Lobby) {
      await this.reject(
        peerId,
        RejectReason.GameStarted,
        'The game has already started.',
      );
      return;
    }
    if (this.humanCount() >= this.state.seatCount) {
      await this.reject(peerId, RejectReason.Full, 'The game is full.');
      return;
    }

    const link = this.pendingLinks.get(peerId);
    this.pendingLinks.delete(peerId);
    const token = uuid();
    const peer: SessionPeer = {
      playerId: message.from,
      name: message.p.playerName,
      isHost: false,
      kind: PlayerKind.Human,
      connected: true,
      peerId,
      verificationCode: link?.verificationCode,
    };
    this.tokens.set(peer.playerId, token);
    this.update({ peers: [...this.state.peers, peer] });
    this.addSystemMessage(`${peer.name} joined`);
    this.emitEvent({ type: 'peerJoined', name: peer.name });

    await this.sendTo(peerId, MessageType.HelloAck, {
      hostName: this.state.self.name,
      gameName: this.state.gameName,
      seatCount: this.state.seatCount,
      phase: this.state.phase,
      peers: this.everyone(),
      reconnectToken: token,
    });
    await this.broadcastLobbyState(peerId);
    await this.refreshAdvertising();
  }

  private async rebind(
    seat: SessionPeer,
    peerId: PeerId,
    name: string,
  ): Promise<void> {
    const link = this.pendingLinks.get(peerId);
    this.pendingLinks.delete(peerId);
    if (seat.peerId && seat.peerId !== peerId) {
      await this.transport.disconnect(seat.peerId).catch(() => undefined);
    }
    this.update({
      peers: this.state.peers.map(p =>
        p.playerId === seat.playerId
          ? {
              ...p,
              name,
              peerId,
              verificationCode: link?.verificationCode,
              connected: true,
            }
          : p,
      ),
    });
    this.addSystemMessage(`${name} is back`);
    if (
      this.state.phase !== LobbyPhase.Lobby &&
      this.state.peers.every(p => p.connected)
    ) {
      await this.transport.stopAdvertising().catch(() => undefined);
    }
    await this.sendTo(peerId, MessageType.HelloAck, {
      hostName: this.state.self.name,
      gameName: this.state.gameName,
      seatCount: this.state.seatCount,
      phase: this.state.phase,
      peers: this.everyone(),
      reconnectToken: this.tokens.get(seat.playerId) as string,
    });
    if (this.engine) await this.sendSnapshot(peerId, seat.playerId);
    await this.broadcastLobbyState(peerId);
  }

  private async resync(peer: SessionPeer, knownVersion: number): Promise<void> {
    if (!this.engine || !peer.peerId) return;
    const missing = this.eventLog.since(knownVersion);
    if (missing && missing.length > 0 && missing.length <= 32) {
      for (const { version, event } of missing) {
        await this.sendTo(peer.peerId, MessageType.GameEvent, {
          version,
          event: redactEvent(event, peer.playerId),
        });
      }
      return;
    }
    await this.sendSnapshot(peer.peerId, peer.playerId);
  }

  // ---------------------------------------------------------------------------------------
  // Sending
  // ---------------------------------------------------------------------------------------

  private async sendSnapshot(peerId: PeerId, playerId: string): Promise<void> {
    if (!this.engine) return;
    await this.sendTo(peerId, MessageType.StateSnapshot, {
      view: projectForPlayer(this.engine, playerId),
    });
  }

  private async sendSnapshotToAll(): Promise<void> {
    await Promise.all(
      this.state.peers
        .filter(p => p.kind === PlayerKind.Human && p.peerId && p.connected)
        .map(p => this.sendSnapshot(p.peerId as PeerId, p.playerId)),
    );
  }

  private async relay<T extends MessageType>(
    type: T,
    payload: PayloadOf<T>,
    from: string,
    excludePeerId: PeerId | null,
  ): Promise<void> {
    await Promise.all(
      this.connectedPeerIds()
        .filter(id => id !== excludePeerId)
        .map(id => this.sendTo(id, type, payload, from)),
    );
  }

  private async broadcastLobbyState(excludePeerId?: PeerId): Promise<void> {
    const payload = {
      phase: this.state.phase,
      seatCount: this.state.seatCount,
      peers: this.everyone(),
    };
    await Promise.all(
      this.connectedPeerIds()
        .filter(id => id !== excludePeerId)
        .map(id => this.sendTo(id, MessageType.LobbyState, payload)),
    );
  }

  private async reject(
    peerId: PeerId,
    reason: RejectReason,
    message: string,
  ): Promise<void> {
    await this.sendTo(peerId, MessageType.Rejected, { reason, message });
    this.pendingLinks.delete(peerId);
    // Give the radio a moment to push the REJECTED payload out before the link goes away.
    await delay(this.rejectDisconnectDelayMs);
    await this.transport.disconnect(peerId).catch(() => undefined);
  }

  private async refreshAdvertising(): Promise<void> {
    if (
      this.state.phase !== LobbyPhase.Lobby ||
      this.state.status !== 'hosting'
    )
      return;
    await this.transport
      .updateAdvertising(this.advertisement())
      .catch(e => log.warn('updateAdvertising', e));
  }

  // ---------------------------------------------------------------------------------------
  // State helpers
  // ---------------------------------------------------------------------------------------

  private connectedPeerIds(): PeerId[] {
    return this.state.peers.flatMap(p =>
      p.peerId && p.connected ? [p.peerId] : [],
    );
  }

  private everyone(): PeerInfo[] {
    return [this.state.self, ...this.state.peers.map(toPeerInfo)];
  }

  private advertisement(): GameAdvertisement {
    return {
      protocolVersion: PROTOCOL_VERSION,
      gameId: this.state.gameId,
      gameName: this.state.gameName,
      hostName: this.state.self.name,
      playerCount: this.humanCount(),
      maxPlayers: this.state.seatCount,
      requiresJoinCode: false,
    };
  }
}

/** Bots are ordinary seats to everyone else; only the host knows they are driven locally. */
function createBots(count: number): SessionPeer[] {
  return Array.from({ length: count }, (_, i) => ({
    playerId: `bot-${i + 1}`,
    name: `Bot ${i + 1}`,
    isHost: false,
    kind: PlayerKind.Bot,
    connected: true,
  }));
}

function toPeerInfo({
  playerId,
  name,
  isHost,
  kind,
  connected,
}: SessionPeer): PeerInfo {
  return { playerId, name, isHost, kind, connected };
}

function describeStart(botCount: number): string {
  if (botCount === 0) return 'Game started';
  return `Game started with ${botCount} bot${
    botCount === 1 ? '' : 's'
  } filling the open seats`;
}
