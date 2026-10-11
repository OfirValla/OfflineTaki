import { CardKind, type Card, type Color, isWildCard } from '../cards/Card';
import {
  ADVANCE,
  type CardEffectHandler,
  type ResolveContext,
  type TurnResolution,
} from './CardEffectHandler';
import { matchesPile, matchesTaki } from './matching';

/**
 * One handler per card kind. To add a card (Plus 2, Super TAKI, King, ...): add the kind to
 * `CardKind`, its cards to the deck builder, and one handler here. Nothing else changes.
 */

const standardPlay = {
  canPlay: (card: Card, top: Card, activeColor: Color) =>
    matchesPile(card, top, activeColor),
  canPlayInTaki: (card: Card, takiColor: Color) => matchesTaki(card, takiColor),
};

export const NumberHandler: CardEffectHandler = {
  kind: CardKind.Number,
  ...standardPlay,
  resolve: () => ADVANCE,
};

export const StopHandler: CardEffectHandler = {
  kind: CardKind.Stop,
  ...standardPlay,
  // With two players skipping one lands on yourself, which is exactly the rule.
  resolve: () => ({ kind: 'advance', skip: 1 }),
};

export const PlusHandler: CardEffectHandler = {
  kind: CardKind.Plus,
  ...standardPlay,
  resolve: () => ({ kind: 'samePlayer' }),
};

export const ChangeDirectionHandler: CardEffectHandler = {
  kind: CardKind.ChangeDirection,
  ...standardPlay,
  resolve: (_card, context: ResolveContext): TurnResolution =>
    context.playerCount === 2 && context.rules.twoPlayerReverseActsAsStop
      ? { kind: 'advance', skip: 1 }
      : { kind: 'reverse' },
};

export const TakiHandler: CardEffectHandler = {
  kind: CardKind.Taki,
  ...standardPlay,
  resolve: (card): TurnResolution =>
    isWildCard(card) ? ADVANCE : { kind: 'openTaki', color: card.color },
};

export const ChangeColorHandler: CardEffectHandler = {
  kind: CardKind.ChangeColor,
  canPlay: () => true,
  canPlayInTaki: () => false,
  resolve: (_card, context): TurnResolution =>
    context.chosenColor ? ADVANCE : { kind: 'chooseColor' },
};

const REGISTRY: ReadonlyMap<CardKind, CardEffectHandler> = new Map(
  [
    NumberHandler,
    StopHandler,
    PlusHandler,
    ChangeDirectionHandler,
    TakiHandler,
    ChangeColorHandler,
  ].map(handler => [handler.kind, handler] as const),
);

export function handlerFor(card: Card): CardEffectHandler {
  const handler = REGISTRY.get(card.kind);
  if (!handler)
    throw new Error(`No handler registered for card kind ${card.kind}`);
  return handler;
}
