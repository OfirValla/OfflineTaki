import { z } from 'zod';
import {
  CardKind,
  Color,
  EngineEventType,
  GameActionType,
  type Card,
  type ClientEvent,
  type GameAction,
  type GamePhase,
  type PlayerView,
} from '../../game';

/**
 * Runtime schemas for the game types that cross the wire. The engine's TypeScript types are the
 * source of truth; the `Assignable` checks at the bottom fail compilation if these drift.
 */

const Id = z.string().min(1).max(64);
const CardId = z.string().min(1).max(40);
const Count = z.number().int().min(0);

export const ColorSchema = z.enum(Color);
export const DirectionSchema = z.union([z.literal(1), z.literal(-1)]);

const NumberValueSchema = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
]);

export const CardSchema = z.discriminatedUnion('kind', [
  z.object({
    id: CardId,
    kind: z.literal(CardKind.Number),
    color: ColorSchema,
    value: NumberValueSchema,
  }),
  z.object({
    id: CardId,
    kind: z.enum([
      CardKind.Stop,
      CardKind.Plus,
      CardKind.ChangeDirection,
      CardKind.Taki,
    ]),
    color: ColorSchema,
  }),
  z.object({ id: CardId, kind: z.literal(CardKind.ChangeColor) }),
]);

export const GamePhaseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('AwaitingPlay'),
    playerId: Id,
    afterPlus: z.boolean(),
  }),
  z.object({
    kind: z.literal('TakiSequence'),
    playerId: Id,
    color: ColorSchema,
    playedCount: Count,
    lastCardId: CardId,
  }),
  z.object({ kind: z.literal('AwaitingColorChoice'), playerId: Id }),
  z.object({
    kind: z.literal('Finished'),
    winnerId: Id,
    finishOrder: z.array(Id).max(8),
  }),
]);

export const GameActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(GameActionType.PlayCard),
    cardId: CardId,
    chosenColor: ColorSchema.optional(),
  }),
  z.object({ type: z.literal(GameActionType.DrawCard) }),
  z.object({ type: z.literal(GameActionType.ChooseColor), color: ColorSchema }),
  z.object({ type: z.literal(GameActionType.CloseTaki) }),
]);

export const ClientEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(EngineEventType.GameStarted),
    startingPlayerId: Id,
    topCard: CardSchema,
    activeColor: ColorSchema,
  }),
  z.object({
    type: z.literal(EngineEventType.HandDealt),
    playerId: Id,
    count: Count,
    cards: z.array(CardSchema).optional(),
  }),
  z.object({
    type: z.literal(EngineEventType.CardPlayed),
    playerId: Id,
    card: CardSchema,
    activeColor: ColorSchema,
  }),
  z.object({
    type: z.literal(EngineEventType.CardsDrawn),
    playerId: Id,
    count: Count,
    reason: z.enum(['turn', 'forced']),
    cards: z.array(CardSchema).optional(),
  }),
  z.object({
    type: z.literal(EngineEventType.ColorChosen),
    playerId: Id,
    color: ColorSchema,
  }),
  z.object({
    type: z.literal(EngineEventType.DirectionChanged),
    direction: DirectionSchema,
  }),
  z.object({ type: z.literal(EngineEventType.PlayerSkipped), playerId: Id }),
  z.object({
    type: z.literal(EngineEventType.TakiOpened),
    playerId: Id,
    color: ColorSchema,
  }),
  z.object({
    type: z.literal(EngineEventType.TakiClosed),
    playerId: Id,
    cardsPlayed: Count,
  }),
  z.object({
    type: z.literal(EngineEventType.DeckReshuffled),
    drawPileCount: Count,
  }),
  z.object({
    type: z.literal(EngineEventType.PhaseChanged),
    phase: GamePhaseSchema,
    currentPlayerId: Id,
    direction: DirectionSchema,
  }),
  z.object({
    type: z.literal(EngineEventType.GameFinished),
    winnerId: Id,
    finishOrder: z.array(Id).max(8),
  }),
]);

export const PlayerViewSchema = z.object({
  gameId: Id,
  version: Count,
  phase: GamePhaseSchema,
  currentPlayerId: Id,
  direction: DirectionSchema,
  activeColor: ColorSchema,
  topCard: CardSchema,
  drawPileCount: Count,
  discardPileCount: Count,
  players: z
    .array(
      z.object({
        id: Id,
        name: z.string().min(1).max(32),
        seat: Count,
        cardCount: Count,
      }),
    )
    .max(8),
  you: z.object({ playerId: Id, hand: z.array(CardSchema).max(120) }),
});

// Compile-time drift checks: the wire types must be assignable to the engine types and back.
// The tuple is exported so that nothing here counts as unused; it is never referenced at runtime.
type Assignable<T, U extends T> = U extends T ? true : never;
export type WireTypeChecks = [
  Assignable<Card, z.infer<typeof CardSchema>>,
  Assignable<z.infer<typeof CardSchema>, Card>,
  Assignable<GamePhase, z.infer<typeof GamePhaseSchema>>,
  Assignable<z.infer<typeof GamePhaseSchema>, GamePhase>,
  Assignable<GameAction, z.infer<typeof GameActionSchema>>,
  Assignable<z.infer<typeof GameActionSchema>, GameAction>,
  Assignable<ClientEvent, z.infer<typeof ClientEventSchema>>,
  Assignable<z.infer<typeof ClientEventSchema>, ClientEvent>,
  Assignable<PlayerView, z.infer<typeof PlayerViewSchema>>,
  Assignable<z.infer<typeof PlayerViewSchema>, PlayerView>,
];
