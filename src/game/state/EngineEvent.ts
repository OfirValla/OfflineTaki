import type { Card, Color } from '../cards/Card';
import type { Direction, GamePhase } from './GameState';

/**
 * What happened, with full information. The host keeps these; clients receive redacted
 * `ClientEvent`s (see `projection.ts`) so that nobody learns another player's cards.
 */
export enum EngineEventType {
  GameStarted = 'GAME_STARTED',
  HandDealt = 'HAND_DEALT',
  CardPlayed = 'CARD_PLAYED',
  CardsDrawn = 'CARDS_DRAWN',
  ColorChosen = 'COLOR_CHOSEN',
  DirectionChanged = 'DIRECTION_CHANGED',
  PlayerSkipped = 'PLAYER_SKIPPED',
  TakiOpened = 'TAKI_OPENED',
  TakiClosed = 'TAKI_CLOSED',
  DeckReshuffled = 'DECK_RESHUFFLED',
  /** Authoritative turn state after an action; clients update "whose turn" from this alone. */
  PhaseChanged = 'PHASE_CHANGED',
  GameFinished = 'GAME_FINISHED',
}

export type DrawReason = 'turn' | 'forced';

export type EngineEvent =
  | {
      type: EngineEventType.GameStarted;
      startingPlayerId: string;
      topCard: Card;
      activeColor: Color;
    }
  | { type: EngineEventType.HandDealt; playerId: string; cards: Card[] }
  | {
      type: EngineEventType.CardPlayed;
      playerId: string;
      card: Card;
      activeColor: Color;
    }
  | {
      type: EngineEventType.CardsDrawn;
      playerId: string;
      cards: Card[];
      reason: DrawReason;
    }
  | { type: EngineEventType.ColorChosen; playerId: string; color: Color }
  | { type: EngineEventType.DirectionChanged; direction: Direction }
  | { type: EngineEventType.PlayerSkipped; playerId: string }
  | { type: EngineEventType.TakiOpened; playerId: string; color: Color }
  | { type: EngineEventType.TakiClosed; playerId: string; cardsPlayed: number }
  | { type: EngineEventType.DeckReshuffled; drawPileCount: number }
  | {
      type: EngineEventType.PhaseChanged;
      phase: GamePhase;
      currentPlayerId: string;
      direction: Direction;
    }
  | {
      type: EngineEventType.GameFinished;
      winnerId: string;
      finishOrder: string[];
    };
