import type {
  ClientEvent,
  GameAction,
  LegalMoves,
  PlayerView,
} from '../../game';
import type { Unsubscribe } from '../../utils/Emitter';
import type { LobbyPhase, PeerInfo } from '../protocol';
import type { DiscoveredGame, PeerId } from '../transport/types';

/** State shape shared by the host and client sessions; the UI only ever sees this. */

export type SessionRole = 'host' | 'client';

export type SessionStatus =
  | 'idle'
  | 'hosting'
  | 'connecting'
  | 'joining'
  | 'joined'
  | 'rejected'
  | 'disconnected'
  | 'closed';

export interface SessionPeer extends PeerInfo {
  /** Present only for peers this device has a direct link to. */
  peerId?: PeerId;
  verificationCode?: string;
}

export interface ChatEntry {
  id: string;
  kind: 'chat' | 'system';
  fromId: string;
  fromName: string;
  text: string;
  at: number;
}

export interface ActionRejection {
  actionId: string;
  code: string;
  message: string;
  at: number;
}

export interface SessionState {
  role: SessionRole;
  status: SessionStatus;
  gameId: string;
  gameName: string;
  hostName: string;
  self: PeerInfo;
  phase: LobbyPhase;
  /** Total seats at the table, humans plus bots. */
  seatCount: number;
  /** Everyone except this device: humans, and bots once the game has started. */
  peers: SessionPeer[];
  messages: ChatEntry[];
  error?: string;
  /** This player's view of the running game; null while in the lobby. */
  game: PlayerView | null;
  /** Most recent action the host refused, for a toast. */
  lastRejection: ActionRejection | null;
  /** An action is in flight; the UI disables input until the host answers. */
  pendingActionId: string | null;
  /** Client: secret that reclaims this seat after a dropped link. */
  reconnectToken: string | null;
}

/**
 * Things that happen, as opposed to how things are. Sounds and animations hang off these;
 * state snapshots (which carry no history) never produce them.
 */
export type SessionEvent =
  | { type: 'game'; event: ClientEvent }
  | { type: 'peerJoined'; name: string }
  | { type: 'gameStarted' }
  | { type: 'actionRejected'; code: string };

export interface GameSession {
  readonly role: SessionRole;
  getState(): SessionState;
  subscribe(listener: (state: SessionState) => void): Unsubscribe;
  subscribeEvents(listener: (event: SessionEvent) => void): Unsubscribe;
  sendChat(text: string): Promise<void>;
  leave(): Promise<void>;
  /** Submits a game action for this player. Outcome arrives through state (`game` / `lastRejection`). */
  act(action: GameAction): Promise<void>;
  legalMoves(): LegalMoves;
  humanCount(): number;
  openSeats(): number;
}

export interface HostSession extends GameSession {
  startHosting(): Promise<void>;
  setSeatCount(requested: number): Promise<number>;
  /** Starts the game (bots fill open seats), or deals a new game after one has finished. */
  startGame(): Promise<void>;
}

export interface ClientSession extends GameSession {
  join(game: DiscoveredGame): Promise<void>;
}
