import {
  CardKind,
  Color,
  type Card,
  type ColoredActionCard,
  type NumberCard,
  type NumberValue,
  type WildCard,
} from '../cards/Card';
import { createRng } from '../engine/rng';
import type { EngineResult, ReduceResult } from '../engine/GameEngine';
import { resolveRules, type RuleSet } from '../rules/RuleSet';
import type {
  Direction,
  GamePhase,
  GameState,
  PlayerState,
} from '../state/GameState';
import type { RuleViolationCode } from '../state/RuleViolation';

/**
 * Builders for hand-crafted game states so tests never depend on a shuffle. Also handy for
 * host/client tests in later phases.
 */

let counter = 0;
const nextId = (base: string) => `${base}#${++counter}`;

export const card = {
  num: (color: Color, value: NumberValue, id?: string): NumberCard => ({
    id: id ?? nextId(`${color}-${value}`),
    kind: CardKind.Number,
    color,
    value,
  }),
  stop: (color: Color, id?: string): ColoredActionCard => ({
    id: id ?? nextId(`${color}-stop`),
    kind: CardKind.Stop,
    color,
  }),
  plus: (color: Color, id?: string): ColoredActionCard => ({
    id: id ?? nextId(`${color}-plus`),
    kind: CardKind.Plus,
    color,
  }),
  reverse: (color: Color, id?: string): ColoredActionCard => ({
    id: id ?? nextId(`${color}-reverse`),
    kind: CardKind.ChangeDirection,
    color,
  }),
  taki: (color: Color, id?: string): ColoredActionCard => ({
    id: id ?? nextId(`${color}-taki`),
    kind: CardKind.Taki,
    color,
  }),
  wild: (id?: string): WildCard => ({
    id: id ?? nextId('wild'),
    kind: CardKind.ChangeColor,
  }),
};

export interface MakeStateOptions {
  /** One hand per player; player ids are p1, p2, ... in seat order. */
  hands: Card[][];
  top: Card;
  activeColor?: Color;
  currentSeat?: number;
  direction?: Direction;
  drawPile?: Card[];
  /** Cards under the top card, bottom first. */
  discardUnder?: Card[];
  phase?: GamePhase;
  rules?: Partial<RuleSet>;
}

export function makeState(options: MakeStateOptions): GameState {
  const players: PlayerState[] = options.hands.map((hand, seat) => ({
    id: `p${seat + 1}`,
    name: `Player ${seat + 1}`,
    seat,
    hand: hand.slice(),
  }));
  const currentSeat = options.currentSeat ?? 0;
  const activeColor =
    options.activeColor ??
    (options.top.kind === CardKind.ChangeColor ? Color.Red : options.top.color);
  return {
    gameId: 'test-game',
    rules: resolveRules(options.rules),
    phase: options.phase ?? {
      kind: 'AwaitingPlay',
      playerId: players[currentSeat].id,
      afterPlus: false,
    },
    players,
    currentSeat,
    direction: options.direction ?? 1,
    drawPile: options.drawPile ?? [],
    discardPile: [...(options.discardUnder ?? []), options.top],
    activeColor,
    rng: createRng(1),
    version: 0,
  };
}

export function expectOk(result: ReduceResult): EngineResult {
  if (!result.ok) {
    throw new Error(
      `Expected success but got ${result.error.code}: ${result.error.message}`,
    );
  }
  return result.value;
}

export function expectViolation(
  result: ReduceResult,
  code: RuleViolationCode,
): void {
  if (result.ok)
    throw new Error(`Expected violation ${code} but the action succeeded`);
  if (result.error.code !== code) {
    throw new Error(
      `Expected violation ${code} but got ${result.error.code}: ${result.error.message}`,
    );
  }
}

export function handOf(state: GameState, playerId: string): Card[] {
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error(`Unknown player ${playerId}`);
  return player.hand;
}
