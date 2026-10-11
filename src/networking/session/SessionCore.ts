import { legalMovesForView, NO_MOVES, type LegalMoves } from '../../game';
import { Emitter, type Unsubscribe } from '../../utils/Emitter';
import { uuid } from '../../utils/ids';
import { createLogger } from '../../utils/logger';
import { LobbyPhase, PlayerKind } from '../protocol';
import {
  createMessage,
  decodeMessage,
  encodeMessage,
  type Message,
  type MessageType,
  type PayloadOf,
} from '../protocol';
import type {
  NearbyTransport,
  PeerId,
  TransportEvent,
} from '../transport/types';
import type { ChatEntry, SessionRole, SessionState } from './SessionState';

const log = createLogger('Session');

/** Plumbing shared by GameHost and GameClient: state, subscriptions, chat log, message I/O. */
export abstract class SessionCore {
  protected state: SessionState;
  private readonly changes = new Emitter<SessionState>();
  protected readonly now: () => number;
  private unsubscribeTransport: Unsubscribe | null;

  protected constructor(
    protected readonly transport: NearbyTransport,
    initial: SessionState,
    now: () => number,
  ) {
    this.state = initial;
    this.now = now;
    this.unsubscribeTransport = transport.subscribe(event =>
      this.handleTransportEvent(event),
    );
  }

  get role(): SessionRole {
    return this.state.role;
  }

  getState(): SessionState {
    return this.state;
  }

  subscribe(listener: (state: SessionState) => void): Unsubscribe {
    return this.changes.subscribe(listener);
  }

  /** Humans at the table, including this device. */
  humanCount(): number {
    return 1 + this.state.peers.filter(p => p.kind === PlayerKind.Human).length;
  }

  /** Seats that bots would take if the host started right now. */
  openSeats(): number {
    if (this.state.phase !== LobbyPhase.Lobby) return 0;
    return Math.max(0, this.state.seatCount - this.humanCount());
  }

  legalMoves(): LegalMoves {
    return this.state.game ? legalMovesForView(this.state.game) : NO_MOVES;
  }

  // --- to implement --------------------------------------------------------------------

  protected abstract handleTransportEvent(event: TransportEvent): void;
  protected abstract handleMessage(peerId: PeerId, message: Message): void;

  // --- helpers for subclasses ------------------------------------------------------------

  protected stopListening(): void {
    this.unsubscribeTransport?.();
    this.unsubscribeTransport = null;
  }

  protected handleRawMessage(peerId: PeerId, raw: string): void {
    const decoded = decodeMessage(raw);
    if (!decoded.ok) {
      log.warn('Dropping unreadable message from', peerId, decoded.error);
      return;
    }
    this.handleMessage(peerId, decoded.value);
  }

  protected async sendTo<T extends MessageType>(
    peerId: PeerId,
    type: T,
    payload: PayloadOf<T>,
    from: string = this.state.self.playerId,
  ): Promise<void> {
    const message = createMessage(
      type,
      { gameId: this.state.gameId, senderId: from },
      payload,
      this.now,
    );
    try {
      await this.transport.send(peerId, encodeMessage(message));
    } catch (error) {
      log.warn('send failed', peerId, type, describeError(error));
    }
  }

  protected update(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    this.changes.emit(this.state);
  }

  protected addSystemMessage(text: string): void {
    this.appendMessage({
      id: uuid(),
      kind: 'system',
      fromId: 'system',
      fromName: '',
      text,
      at: this.now(),
    });
  }

  protected appendMessage(entry: ChatEntry): void {
    this.update({ messages: [...this.state.messages, entry] });
  }

  protected chatEntryFrom(
    id: string,
    fromId: string,
    fromName: string,
    text: string,
  ): ChatEntry {
    return { id, kind: 'chat', fromId, fromName, text, at: this.now() };
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(() => resolve(), ms));
}
