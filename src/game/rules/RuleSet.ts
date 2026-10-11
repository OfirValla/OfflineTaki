import { DEFAULT_DECK, type DeckComposition } from '../cards/deck';

/** House rules. Everything the engine treats as a policy rather than a law lives here. */
export interface RuleSet {
  initialHandSize: number;
  deck: DeckComposition;
  /** A Plus cannot be the last card: the player draws one instead of winning. */
  cannotFinishOnPlus: boolean;
  /** With two players a Change Direction behaves like a Stop (the same player plays again). */
  twoPlayerReverseActsAsStop: boolean;
}

export const DEFAULT_RULES: RuleSet = {
  initialHandSize: 8,
  deck: DEFAULT_DECK,
  cannotFinishOnPlus: true,
  twoPlayerReverseActsAsStop: true,
};

export function resolveRules(overrides: Partial<RuleSet> = {}): RuleSet {
  return {
    ...DEFAULT_RULES,
    ...overrides,
    deck: { ...DEFAULT_RULES.deck, ...overrides.deck },
  };
}
