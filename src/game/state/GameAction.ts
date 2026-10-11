import type { Color } from '../cards/Card';

/**
 * Everything a player can ask the engine to do. There is no "end turn": a turn ends by itself
 * after a play or a draw; the only explicit "I'm done" is closing a TAKI.
 */
export enum GameActionType {
  PlayCard = 'PLAY_CARD',
  DrawCard = 'DRAW_CARD',
  ChooseColor = 'CHOOSE_COLOR',
  CloseTaki = 'CLOSE_TAKI',
}

export type GameAction =
  | {
      type: GameActionType.PlayCard;
      cardId: string;
      /** Optional shortcut for Change Color: pick the colour in the same action. */
      chosenColor?: Color;
    }
  | { type: GameActionType.DrawCard }
  | { type: GameActionType.ChooseColor; color: Color }
  | { type: GameActionType.CloseTaki };

export const playCard = (cardId: string, chosenColor?: Color): GameAction => ({
  type: GameActionType.PlayCard,
  cardId,
  ...(chosenColor ? { chosenColor } : {}),
});
export const drawCard = (): GameAction => ({ type: GameActionType.DrawCard });
export const chooseColor = (color: Color): GameAction => ({
  type: GameActionType.ChooseColor,
  color,
});
export const closeTaki = (): GameAction => ({ type: GameActionType.CloseTaki });
