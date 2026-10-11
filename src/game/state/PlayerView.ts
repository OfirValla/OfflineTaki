import type { Card, Color } from '../cards/Card';
import { computeLegalMoves, type LegalMoves } from '../engine/legalMoves';
import {
  EngineEventType,
  type DrawReason,
  type EngineEvent,
} from './EngineEvent';
import {
  currentPlayerId,
  topCard,
  type Direction,
  type GamePhase,
  type GameState,
} from './GameState';

/**
 * Everything one player is allowed to know. Built on the host, sent to that player only.
 * Other hands appear as counts; the draw pile is a count; the phase is public by design.
 */
export interface PlayerView {
  gameId: string;
  version: number;
  phase: GamePhase;
  currentPlayerId: string;
  direction: Direction;
  activeColor: Color;
  topCard: Card;
  drawPileCount: number;
  discardPileCount: number;
  players: Array<{ id: string; name: string; seat: number; cardCount: number }>;
  you: { playerId: string; hand: Card[] };
}

export function projectForPlayer(
  state: GameState,
  viewerId: string,
): PlayerView {
  const viewer = state.players.find(p => p.id === viewerId);
  if (!viewer) throw new Error(`Unknown player ${viewerId}`);
  return {
    gameId: state.gameId,
    version: state.version,
    phase: state.phase,
    currentPlayerId: currentPlayerId(state),
    direction: state.direction,
    activeColor: state.activeColor,
    topCard: topCard(state),
    drawPileCount: state.drawPile.length,
    discardPileCount: state.discardPile.length,
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      cardCount: p.hand.length,
    })),
    you: { playerId: viewer.id, hand: viewer.hand.slice() },
  };
}

export function legalMovesForView(view: PlayerView): LegalMoves {
  return computeLegalMoves({
    phase: view.phase,
    playerId: view.you.playerId,
    hand: view.you.hand,
    topCard: view.topCard,
    activeColor: view.activeColor,
  });
}

/** Engine events as a client may see them: card lists become counts unless they are yours. */
export type ClientEvent =
  | Exclude<
      EngineEvent,
      { type: EngineEventType.HandDealt } | { type: EngineEventType.CardsDrawn }
    >
  | {
      type: EngineEventType.HandDealt;
      playerId: string;
      count: number;
      cards?: Card[];
    }
  | {
      type: EngineEventType.CardsDrawn;
      playerId: string;
      count: number;
      reason: DrawReason;
      cards?: Card[];
    };

export function redactEvent(event: EngineEvent, viewerId: string): ClientEvent {
  switch (event.type) {
    case EngineEventType.HandDealt:
      return event.playerId === viewerId
        ? {
            type: event.type,
            playerId: event.playerId,
            count: event.cards.length,
            cards: event.cards,
          }
        : {
            type: event.type,
            playerId: event.playerId,
            count: event.cards.length,
          };
    case EngineEventType.CardsDrawn:
      return event.playerId === viewerId
        ? {
            type: event.type,
            playerId: event.playerId,
            count: event.cards.length,
            reason: event.reason,
            cards: event.cards,
          }
        : {
            type: event.type,
            playerId: event.playerId,
            count: event.cards.length,
            reason: event.reason,
          };
    default:
      return event;
  }
}
