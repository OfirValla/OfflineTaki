import { type Card, type Color } from '../cards/Card';
import { handlerFor } from '../rules/handlers';
import type { GamePhase } from '../state/GameState';

export interface LegalMoves {
  isYourTurn: boolean;
  playableCardIds: string[];
  canDraw: boolean;
  canCloseTaki: boolean;
  mustChooseColor: boolean;
}

export interface LegalMovesInput {
  phase: GamePhase;
  playerId: string;
  hand: Card[];
  topCard: Card;
  activeColor: Color;
}

export const NO_MOVES: LegalMoves = {
  isYourTurn: false,
  playableCardIds: [],
  canDraw: false,
  canCloseTaki: false,
  mustChooseColor: false,
};

/**
 * Works from the information a single player has (their hand plus the public pile), so the
 * same function highlights playable cards on a phone and validates actions on the host.
 */
export function computeLegalMoves(input: LegalMovesInput): LegalMoves {
  const { phase, playerId, hand, topCard, activeColor } = input;
  if (phase.kind === 'Finished' || phase.playerId !== playerId) return NO_MOVES;

  switch (phase.kind) {
    case 'AwaitingPlay':
      return {
        isYourTurn: true,
        playableCardIds: hand
          .filter(card => handlerFor(card).canPlay(card, topCard, activeColor))
          .map(card => card.id),
        canDraw: true,
        canCloseTaki: false,
        mustChooseColor: false,
      };
    case 'TakiSequence':
      return {
        isYourTurn: true,
        playableCardIds: hand
          .filter(card => handlerFor(card).canPlayInTaki(card, phase.color))
          .map(card => card.id),
        canDraw: false,
        canCloseTaki: true,
        mustChooseColor: false,
      };
    case 'AwaitingColorChoice':
      return { ...NO_MOVES, isYourTurn: true, mustChooseColor: true };
  }
}
