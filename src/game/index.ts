/**
 * Public surface of the rules engine. Networking (Phase 4) and UI (Phase 5) import from here
 * and nowhere deeper.
 */
export {
  ALL_COLORS,
  CardKind,
  Color,
  NUMBER_VALUES,
  cardColor,
  describeCard,
  isNumberCard,
  isWildCard,
} from './cards/Card';
export type {
  Card,
  ColoredActionCard,
  NumberCard,
  NumberValue,
  WildCard,
} from './cards/Card';
export { buildDeck, DEFAULT_DECK } from './cards/deck';
export type { DeckComposition } from './cards/deck';
export { DEFAULT_RULES, resolveRules } from './rules/RuleSet';
export type { RuleSet } from './rules/RuleSet';
export { matchesPile, matchesTaki } from './rules/matching';
export type {
  CardEffectHandler,
  ResolveContext,
  TurnResolution,
} from './rules/CardEffectHandler';
export { handlerFor } from './rules/handlers';
export {
  GameActionType,
  chooseColor,
  closeTaki,
  drawCard,
  playCard,
} from './state/GameAction';
export type { GameAction } from './state/GameAction';
export { EngineEventType } from './state/EngineEvent';
export type { DrawReason, EngineEvent } from './state/EngineEvent';
export {
  currentPlayer,
  currentPlayerId,
  findPlayer,
  topCard,
} from './state/GameState';
export type {
  Direction,
  GamePhase,
  GameState,
  PlayerState,
} from './state/GameState';
export { RuleViolationCode, violation } from './state/RuleViolation';
export type { RuleViolation } from './state/RuleViolation';
export {
  legalMovesForView,
  projectForPlayer,
  redactEvent,
} from './state/PlayerView';
export type { ClientEvent, PlayerView } from './state/PlayerView';
export { computeLegalMoves, NO_MOVES } from './engine/legalMoves';
export type { LegalMoves, LegalMovesInput } from './engine/legalMoves';
export { createGame, legalMoves, reduce } from './engine/GameEngine';
export type {
  CreateGameOptions,
  EngineResult,
  ReduceResult,
} from './engine/GameEngine';
export { createRng, nextInt, nextRandom, shuffle } from './engine/rng';
export type { RngState } from './engine/rng';
