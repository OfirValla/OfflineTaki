import type { Card, Color } from '../cards/Card';
import type { RngState } from '../engine/rng';
import type { RuleSet } from '../rules/RuleSet';

export type Direction = 1 | -1;

/**
 * The explicit turn state machine. Lobby and "starting" are session concerns: by the time a
 * GameState exists the cards are dealt and someone is on turn.
 */
export type GamePhase =
  /** Normal turn. `afterPlus` means the player just played a Plus and must play again. */
  | { kind: 'AwaitingPlay'; playerId: string; afterPlus: boolean }
  /** An open TAKI: only cards of `color` may follow until the player closes it. */
  | {
      kind: 'TakiSequence';
      playerId: string;
      color: Color;
      playedCount: number;
      lastCardId: string;
    }
  /** A Change Color was played without a colour; waiting for the choice. */
  | { kind: 'AwaitingColorChoice'; playerId: string }
  | { kind: 'Finished'; winnerId: string; finishOrder: string[] };

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  hand: Card[];
}

/** Full, host-only truth. Never sent to a client as-is; see `PlayerView`. */
export interface GameState {
  gameId: string;
  rules: RuleSet;
  phase: GamePhase;
  /** Seat order; index equals `seat`. */
  players: PlayerState[];
  currentSeat: number;
  direction: Direction;
  drawPile: Card[];
  /** Last element is the top card. */
  discardPile: Card[];
  /** Colour in force: the top card's colour, or the one chosen after a Change Color. */
  activeColor: Color;
  rng: RngState;
  /** Increments once per emitted event. */
  version: number;
}

export function currentPlayer(state: GameState): PlayerState {
  return state.players[state.currentSeat];
}

export function currentPlayerId(state: GameState): string {
  return currentPlayer(state).id;
}

export function topCard(state: GameState): Card {
  return state.discardPile[state.discardPile.length - 1];
}

export function findPlayer(
  state: GameState,
  playerId: string,
): PlayerState | undefined {
  return state.players.find(p => p.id === playerId);
}
