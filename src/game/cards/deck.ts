import {
  ALL_COLORS,
  COLORED_ACTION_KINDS,
  CardKind,
  NUMBER_VALUES,
  type Card,
} from './Card';

export interface DeckComposition {
  /** How many copies of each colored card (numbers and colored actions). */
  copies: number;
  /** How many Change Color wild cards in total. */
  changeColorCards: number;
}

export const DEFAULT_DECK: DeckComposition = { copies: 2, changeColorCards: 4 };

const COPY_SUFFIX = 'abcdefgh';

/**
 * Builds an unshuffled deck with deterministic, human-readable ids such as `red-7-a`,
 * `blue-stop-b` or `wild-change-color-3`. Ids are unique within a deck.
 */
export function buildDeck(composition: DeckComposition = DEFAULT_DECK): Card[] {
  if (composition.copies < 1 || composition.copies > COPY_SUFFIX.length) {
    throw new Error(`copies must be between 1 and ${COPY_SUFFIX.length}`);
  }
  const cards: Card[] = [];
  for (let copy = 0; copy < composition.copies; copy++) {
    const suffix = COPY_SUFFIX[copy];
    for (const color of ALL_COLORS) {
      for (const value of NUMBER_VALUES) {
        cards.push({
          id: `${color}-${value}-${suffix}`,
          kind: CardKind.Number,
          color,
          value,
        });
      }
      for (const kind of COLORED_ACTION_KINDS) {
        cards.push({ id: `${color}-${kind}-${suffix}`, kind, color });
      }
    }
  }
  for (let i = 0; i < composition.changeColorCards; i++) {
    cards.push({
      id: `wild-change-color-${i + 1}`,
      kind: CardKind.ChangeColor,
    });
  }
  return cards;
}
