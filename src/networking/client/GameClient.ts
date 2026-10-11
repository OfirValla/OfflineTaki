import type { GameAction } from '../../game';
import { uuid } from '../../utils/ids';
import { createLogger } from '../../utils/logger';
import {
  LobbyPhase,
  MessageType,
  PROTOCOL_VERSION,
  PlayerKind,
  DEFAULT_SEATS,
  type Message,
  type PeerInfo,
  type ReactionEmoji,
} from '../protocol';
import { describeError, SessionCore } from '../session/SessionCore';
import type {
  ClientSession,
  SessionPeer,
  SessionState,
} from '../session/SessionState';
import type {
  DiscoveredGame,
  NearbyTransport,
  PeerId,
  TransportEvent,
} from '../transport/types';
import { applyClientEvent } from './applyClientEvent';

export interface GameClientOptions {
  self: { playerId: string; name: string };
  appVersion: string;
  joinTimeoutMs?: number;
  /** How long to wait for a snapshot before asking again. */
  resyncRetryMs?: number;
  now?: () => number;
}

const DEFAULT_JOIN_TIMEOUT_MS = 10_000;
const DEFAULT_RESYNC_RETRY_MS = 2_000;
const log = createLogger('GameClient');

/**
 * The phone side. Keeps this player's view in step with the host by applying events in version
 * order and asking for a snapshot whenever a gap shows up.
 */
export class GameClient extends SessionCore implements ClientSession {
  private readonly appVersion: string;
  private readonly joinTimeoutMs: number;
  private readonly resyncRetryMs: number;
  private hostPeerId: PeerId | null = null;
  private joinWaiter: {
    resolve: () => void;
    reject: (error: Error) => void;
  } | null = null;
  private resyncTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(transport: NearbyTransport, options: GameClientOptions) {
    const self: PeerInfo = {
      playerId: options.self.playerId,
      name: options.self.name,
      isHost: false,
      kind: PlayerKind.Human,
      connected: true,
    };
    const initial: SessionState = {
      role: 'client',
      status: 'idle',
      gameId: '',
      gameName: '',
      hostName: '',
      self,
      phase: LobbyPhase.Lobby,
      seatCount: DEFAULT_SEATS,
      peers: [],
      messages: [],
      game: null,
      lastRejection: null,
      pendingActionId: null,
      reconnectToken: null,
      reactions: [],
    };
    super(transport, initial, options.now ?? Date.now);
    this.appVersion = options.appVersion;
    this.joinTimeoutMs = options.joinTimeoutMs ?? DEFAULT_JOIN_TIMEOUT_MS;
    this.resyncRetryMs = options.resyncRetryMs ?? DEFAULT_RESYNC_RETRY_MS;
  }

  // ---------------------------------------------------------------------------------------
  // Joining
  // ---------------------------------------------------------------------------------------

  /**
   * Connects and joins. When the client already holds a reconnect token for this game (a
   * dropped link mid-game), the seat is reclaimed instead of a fresh join.
   */
  async join(game: DiscoveredGame): Promise<void> {
    if (game.protocolVersion !== PROTOCOL_VERSION) {
      this.update({
        status: 'rejected',
        error: 'This game runs a different app version.',
      });
      throw new Error('Protocol version mismatch');
    }
    const reclaiming =
      this.state.reconnectToken !== null && this.state.gameId === game.gameId;
    this.update({
      status: 'connecting',
      gameId: game.gameId,
      gameName: game.gameName,
      hostName: game.hostName,
      seatCount: game.maxPlayers,
      error: undefined,
      ...(reclaiming ? {} : { game: null, reconnectToken: null }),
    });
    try {
      await this.transport.connect(game.peerId, {
        localName: this.state.self.name,
      });
    } catch (error) {
      this.update({ status: 'disconnected', error: describeError(error) });
      throw error;
    }
    this.hostPeerId = game.peerId;
    this.update({ status: 'joining' });

    const ackReceived = new Promise<void>((resolve, reject) => {
      this.joinWaiter = { resolve, reject };
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('The host did not answer in time.')),
        this.joinTimeoutMs,
      );
    });

    await this.sendTo(game.peerId, MessageType.Hello, {
      playerName: this.state.self.name,
      protocolVersion: PROTOCOL_VERSION,
      appVersion: this.appVersion,
      ...(reclaiming && this.state.reconnectToken
        ? {
            reconnect: {
              playerId: this.state.self.playerId,
              token: this.state.reconnectToken,
            },
          }
        : {}),
    });

    try {
      await Promise.race([ackReceived, timeout]);
    } catch (error) {
      this.joinWaiter = null;
      if (this.state.status === 'joining') {
        this.update({ status: 'disconnected', error: describeError(error) });
        await this.transport.disconnect(game.peerId).catch(() => undefined);
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Playing
  // ---------------------------------------------------------------------------------------

  async sendReaction(emoji: ReactionEmoji): Promise<void> {
    this.recordReaction(this.state.self.playerId, this.state.self.name, emoji);
    if (this.hostPeerId && this.state.status === 'joined') {
      await this.sendTo(this.hostPeerId, MessageType.Reaction, {
        emoji,
        senderName: this.state.self.name,
      });
    }
  }

  async act(action: GameAction): Promise<void> {
    if (
      !this.hostPeerId ||
      this.state.status !== 'joined' ||
      !this.state.game
    ) {
      throw new Error('Not in a running game');
    }
    const actionId = uuid();
    this.update({ pendingActionId: actionId, lastRejection: null });
    await this.sendTo(this.hostPeerId, MessageType.GameAction, {
      actionId,
      action,
    });
  }

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
    if (this.hostPeerId && this.state.status === 'joined') {
      await this.sendTo(this.hostPeerId, MessageType.Chat, {
        text: trimmed,
        senderName: this.state.self.name,
      });
    }
  }

  async leave(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.stopListening();
    this.clearResyncTimer();
    this.joinWaiter?.reject(new Error('Left the game'));
    this.joinWaiter = null;
    if (this.hostPeerId) {
      await this.transport.disconnect(this.hostPeerId).catch(() => undefined);
    }
    this.update({ status: 'closed' });
  }

  // ---------------------------------------------------------------------------------------
  // Transport events
  // ---------------------------------------------------------------------------------------

  protected handleTransportEvent(event: TransportEvent): void {
    switch (event.type) {
      case 'peerDisconnected':
        if (event.peerId === this.hostPeerId && !this.closed) {
          this.hostPeerId = null;
          this.clearResyncTimer();
          this.joinWaiter?.reject(new Error('Disconnected from host'));
          this.joinWaiter = null;
          if (this.state.status === 'rejected') return; // the rejection already explained why
          this.update({
            status: 'disconnected',
            error: 'Lost the connection to the host.',
            pendingActionId: null,
          });
          this.addSystemMessage('Lost the connection to the host');
        }
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

  protected handleMessage(peerId: PeerId, message: Message): void {
    if (peerId !== this.hostPeerId) return;
    if (message.gid !== this.state.gameId) return;

    switch (message.t) {
      case MessageType.HelloAck:
        this.update({
          status: 'joined',
          hostName: message.p.hostName,
          gameName: message.p.gameName,
          seatCount: message.p.seatCount,
          phase: message.p.phase,
          peers: this.othersFrom(message.p.peers),
          reconnectToken: message.p.reconnectToken,
          error: undefined,
        });
        this.addSystemMessage(`Joined ${message.p.gameName}`);
        this.joinWaiter?.resolve();
        this.joinWaiter = null;
        return;

      case MessageType.Rejected:
        this.update({
          status: 'rejected',
          error: message.p.message ?? message.p.reason,
        });
        this.joinWaiter?.reject(
          new Error(message.p.message ?? message.p.reason),
        );
        this.joinWaiter = null;
        return;

      case MessageType.LobbyState: {
        const known = new Set(this.state.peers.map(p => p.playerId));
        const newcomers = message.p.peers.filter(
          p =>
            !known.has(p.playerId) &&
            p.playerId !== this.state.self.playerId &&
            p.kind === PlayerKind.Human,
        );
        const justStarted =
          this.state.phase === LobbyPhase.Lobby &&
          message.p.phase === LobbyPhase.Started;
        this.update({
          phase: message.p.phase,
          seatCount: message.p.seatCount,
          peers: this.othersFrom(message.p.peers),
        });
        for (const p of newcomers)
          this.emitEvent({ type: 'peerJoined', name: p.name });
        if (justStarted) {
          this.emitEvent({ type: 'gameStarted' });
          const bots = message.p.peers.filter(
            p => p.kind === PlayerKind.Bot,
          ).length;
          this.addSystemMessage(
            bots === 0
              ? 'Game started'
              : `Game started with ${bots} bot${
                  bots === 1 ? '' : 's'
                } filling the open seats`,
          );
        }
        return;
      }

      case MessageType.Chat:
        this.appendMessage(
          this.chatEntryFrom(
            message.id,
            message.from,
            message.p.senderName,
            message.p.text,
          ),
        );
        return;

      case MessageType.StateSnapshot: {
        const view = message.p.view;
        if (this.state.game && view.version < this.state.game.version) return; // stale
        this.clearResyncTimer();
        this.update({ game: view, pendingActionId: null });
        return;
      }

      case MessageType.GameEvent: {
        const { version, event } = message.p;
        const game = this.state.game;
        if (!game) {
          this.requestResync(0);
          return;
        }
        if (version <= game.version) return; // duplicate or already covered by a snapshot
        if (version !== game.version + 1) {
          this.requestResync(game.version);
          return;
        }
        this.update({
          game: applyClientEvent(game, event, version),
          pendingActionId: null,
        });
        this.emitEvent({ type: 'game', event });
        return;
      }

      case MessageType.ActionRejected:
        this.emitEvent({ type: 'actionRejected', code: message.p.code });
        this.update({
          pendingActionId: null,
          lastRejection: {
            actionId: message.p.actionId,
            code: message.p.code,
            message: message.p.message,
            at: this.now(),
          },
        });
        return;

      case MessageType.Reaction:
        this.recordReaction(
          message.from,
          message.p.senderName,
          message.p.emoji,
        );
        return;
      case MessageType.Pong:
        return;
      default:
        return;
    }
  }

  // ---------------------------------------------------------------------------------------
  // Resync
  // ---------------------------------------------------------------------------------------

  private requestResync(knownVersion: number): void {
    if (this.resyncTimer !== null) return; // one request in flight
    const send = () => {
      if (!this.hostPeerId) return;
      void this.sendTo(this.hostPeerId, MessageType.ResyncRequest, {
        knownVersion,
      });
    };
    send();
    this.resyncTimer = setTimeout(() => {
      this.resyncTimer = null;
      const current = this.state.game?.version ?? 0;
      if (current <= knownVersion) this.requestResync(current); // still behind: ask again
    }, this.resyncRetryMs);
  }

  private clearResyncTimer(): void {
    if (this.resyncTimer !== null) {
      clearTimeout(this.resyncTimer);
      this.resyncTimer = null;
    }
  }

  private othersFrom(peers: PeerInfo[]): SessionPeer[] {
    return peers.filter(p => p.playerId !== this.state.self.playerId);
  }
}
