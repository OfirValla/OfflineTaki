/**
 * Card vocabulary. Pure data: no behaviour lives here, only shapes and small helpers.
 * Card behaviour is in `rules/handlers`; adding a card kind means adding a handler.
 */

export enum Color {
  Red = 'red',
  Blue = 'blue',
  Green = 'green',
  Yellow = 'yellow',
}

export const ALL_COLORS: readonly Color[] = [
  Color.Red,
  Color.Blue,
  Color.Green,
  Color.Yellow,
];

export enum CardKind {
  Number = 'number',
  Stop = 'stop',
  Plus = 'plus',
  ChangeDirection = 'change-direction',
  Taki = 'taki',
  ChangeColor = 'change-color',
}

/** TAKI has no 2 card; "+2" is a separate action card added in a later phase. */
export type NumberValue = 1 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const NUMBER_VALUES: readonly NumberValue[] = [1, 3, 4, 5, 6, 7, 8, 9];

export type ColoredActionKind =
  | CardKind.Stop
  | CardKind.Plus
  | CardKind.ChangeDirection
  | CardKind.Taki;
export const COLORED_ACTION_KINDS: readonly ColoredActionKind[] = [
  CardKind.Stop,
  CardKind.Plus,
  CardKind.ChangeDirection,
  CardKind.Taki,
];

export type NumberCard = {
  id: string;
  kind: CardKind.Number;
  color: Color;
  value: NumberValue;
};
export type ColoredActionCard = {
  id: string;
  kind: ColoredActionKind;
  color: Color;
};
export type WildCard = { id: string; kind: CardKind.ChangeColor };

export type Card = NumberCard | ColoredActionCard | WildCard;

export function isNumberCard(card: Card): card is NumberCard {
  return card.kind === CardKind.Number;
}

export function isWildCard(card: Card): card is WildCard {
  return card.kind === CardKind.ChangeColor;
}

/** The card's printed colour, or null for wild cards. */
export function cardColor(card: Card): Color | null {
  return isWildCard(card) ? null : card.color;
}

/** Human-readable label, e.g. "Red 7", "Blue TAKI", "Change Color". */
export function describeCard(card: Card): string {
  const color = (c: Color) => c.charAt(0).toUpperCase() + c.slice(1);
  switch (card.kind) {
    case CardKind.Number:
      return `${color(card.color)} ${card.value}`;
    case CardKind.Stop:
      return `${color(card.color)} Stop`;
    case CardKind.Plus:
      return `${color(card.color)} Plus`;
    case CardKind.ChangeDirection:
      return `${color(card.color)} Change Direction`;
    case CardKind.Taki:
      return `${color(card.color)} TAKI`;
    case CardKind.ChangeColor:
      return 'Change Color';
  }
}
