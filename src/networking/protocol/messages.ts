import { z } from 'zod';
import {
  ClientEventSchema,
  GameActionSchema,
  PlayerViewSchema,
} from './gameSchemas';
import { LobbyPhase, MAX_SEATS, MIN_SEATS, PlayerKind } from './lobby';
import { MessageType, RejectReason } from './MessageType';
import { REACTION_EMOJIS } from './reactions';

/**
 * Wire schemas. Every inbound string is parsed with `MessageSchema`; anything that fails is
 * dropped. Types are inferred from the schemas so TypeScript and the runtime never disagree.
 */

const NAME_MAX = 32;
const Id = z.string().min(1).max(64);

const envelopeBase = z.object({
  v: z.literal(2),
  /** Unique message id, used for de-duplication. */
  id: Id,
  /** Game id this message belongs to. */
  gid: Id,
  /** Sender's player id. */
  from: Id,
  /** Sender wall clock, informational only. */
  ts: z.number(),
});

export const PeerInfoSchema = z.object({
  playerId: Id,
  name: z.string().min(1).max(NAME_MAX),
  isHost: z.boolean(),
  kind: z.enum(PlayerKind),
  /** Humans only: whether their phone is currently linked. Bots are always connected. */
  connected: z.boolean(),
});
export type PeerInfo = z.infer<typeof PeerInfoSchema>;

const SeatCountSchema = z.number().int().min(MIN_SEATS).max(MAX_SEATS);
const LobbyPhaseSchema = z.enum(LobbyPhase);

// --- Lobby -------------------------------------------------------------------------------

export const HelloMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.Hello),
  p: z.object({
    playerName: z.string().min(1).max(NAME_MAX),
    protocolVersion: z.number().int().positive(),
    appVersion: z.string().max(32),
    /** Present when re-joining a seat after a dropped link. */
    reconnect: z
      .object({ playerId: Id, token: z.string().min(8).max(64) })
      .optional(),
  }),
});

export const HelloAckMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.HelloAck),
  p: z.object({
    hostName: z.string().min(1).max(NAME_MAX),
    gameName: z.string().min(1).max(64),
    seatCount: SeatCountSchema,
    phase: LobbyPhaseSchema,
    peers: z.array(PeerInfoSchema),
    /** Secret that lets this player reclaim their seat after a disconnect. */
    reconnectToken: z.string().min(8).max(64),
  }),
});

export const RejectedMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.Rejected),
  p: z.object({
    reason: z.enum(RejectReason),
    message: z.string().max(200).optional(),
  }),
});

/** Host → clients whenever seats, roster or phase change. Always the full picture. */
export const LobbyStateMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.LobbyState),
  p: z.object({
    phase: LobbyPhaseSchema,
    seatCount: SeatCountSchema,
    peers: z.array(PeerInfoSchema),
  }),
});

export const ChatMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.Chat),
  p: z.object({
    text: z.string().min(1).max(500),
    senderName: z.string().min(1).max(NAME_MAX),
  }),
});

/** A quick emoji reaction; relayed by the host like chat. */
export const ReactionMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.Reaction),
  p: z.object({
    emoji: z.enum(REACTION_EMOJIS),
    senderName: z.string().min(1).max(NAME_MAX),
  }),
});

export const PingMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.Ping),
  p: z.object({ nonce: z.string().min(1).max(32) }),
});

export const PongMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.Pong),
  p: z.object({ nonce: z.string().min(1).max(32) }),
});

// --- Game --------------------------------------------------------------------------------

/** Client → host. `actionId` makes retries safe: the host applies each id once. */
export const GameActionMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.GameAction),
  p: z.object({ actionId: Id, action: GameActionSchema }),
});

/** Host → one client. Exactly one message per `version`; the client applies them in order. */
export const GameEventMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.GameEvent),
  p: z.object({
    version: z.number().int().positive(),
    event: ClientEventSchema,
  }),
});

/** Host → one client: that player's complete view. Sent at start, on reconnect and on gaps. */
export const StateSnapshotMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.StateSnapshot),
  p: z.object({ view: PlayerViewSchema }),
});

export const ActionRejectedMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.ActionRejected),
  p: z.object({
    actionId: Id,
    code: z.string().min(1).max(64),
    message: z.string().max(200),
  }),
});

/** Client → host when it detects a gap in event versions. */
export const ResyncRequestMessageSchema = envelopeBase.extend({
  t: z.literal(MessageType.ResyncRequest),
  p: z.object({ knownVersion: z.number().int().min(0) }),
});

export const MessageSchema = z.discriminatedUnion('t', [
  HelloMessageSchema,
  HelloAckMessageSchema,
  RejectedMessageSchema,
  LobbyStateMessageSchema,
  ChatMessageSchema,
  ReactionMessageSchema,
  PingMessageSchema,
  PongMessageSchema,
  GameActionMessageSchema,
  GameEventMessageSchema,
  StateSnapshotMessageSchema,
  ActionRejectedMessageSchema,
  ResyncRequestMessageSchema,
]);

export type Message = z.infer<typeof MessageSchema>;
export type MessageOf<T extends MessageType> = Extract<Message, { t: T }>;
export type PayloadOf<T extends MessageType> = MessageOf<T>['p'];
