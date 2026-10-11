import { type Card, type Color, isNumberCard, isWildCard } from '../cards/Card';

/**
 * The shared matching rule: a card may be played on the discard pile when it shares the active
 * colour, or (for numbers) the same value, or (for action cards) the same symbol. Wild cards
 * always match. Card-specific exceptions live in the handlers, not here.
 */
export function matchesPile(
  card: Card,
  top: Card,
  activeColor: Color,
): boolean {
  if (isWildCard(card)) return true;
  if (card.color === activeColor) return true;
  if (isNumberCard(card)) return isNumberCard(top) && card.value === top.value;
  return !isWildCard(top) && card.kind === top.kind;
}

/** Inside an open TAKI only cards of the TAKI's colour may follow; wilds are not allowed. */
export function matchesTaki(card: Card, takiColor: Color): boolean {
  return !isWildCard(card) && card.color === takiColor;
}
