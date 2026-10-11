import type { Card, CardKind, Color } from '../cards/Card';
import type { RuleSet } from './RuleSet';

/**
 * What a card does to the turn once its effect resolves. Handlers describe; the engine applies.
 * Keeping the description declarative means the same resolution runs whether the card was
 * played directly or as the last card of a TAKI sequence.
 */
export type TurnResolution =
  /** Pass the turn, skipping `skip` players on the way (Stop skips one). */
  | { kind: 'advance'; skip: number }
  /** The same player must play again (Plus). */
  | { kind: 'samePlayer' }
  /** Flip the play direction, then pass the turn. */
  | { kind: 'reverse' }
  /** Wait for the player to pick a colour before the turn passes. */
  | { kind: 'chooseColor' }
  /** Open a TAKI sequence in the given colour. */
  | { kind: 'openTaki'; color: Color };

export interface ResolveContext {
  playerCount: number;
  rules: RuleSet;
  /** Colour supplied together with the play, for cards that need one. */
  chosenColor?: Color;
}

export interface CardEffectHandler {
  readonly kind: CardKind;
  /** May `card` be played on the pile right now? Defaults to the shared matching rule. */
  canPlay(card: Card, top: Card, activeColor: Color): boolean;
  /** May `card` be played inside an open TAKI of `takiColor`? */
  canPlayInTaki(card: Card, takiColor: Color): boolean;
  /** The turn effect of this card, applied on play or when a TAKI sequence closes on it. */
  resolve(card: Card, context: ResolveContext): TurnResolution;
}

export const ADVANCE: TurnResolution = { kind: 'advance', skip: 0 };
