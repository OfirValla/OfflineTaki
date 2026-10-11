export { MessageType, RejectReason, PROTOCOL_VERSION } from './MessageType';
export {
  LobbyPhase,
  PlayerKind,
  MIN_SEATS,
  MAX_SEATS,
  DEFAULT_SEATS,
  clampSeatCount,
} from './lobby';
export type { Message, MessageOf, PayloadOf, PeerInfo } from './messages';
export { MessageSchema } from './messages';
export {
  CardSchema,
  ClientEventSchema,
  ColorSchema,
  GameActionSchema,
  GamePhaseSchema,
  PlayerViewSchema,
} from './gameSchemas';
export { createMessage, decodeMessage, encodeMessage } from './codec';
export type { DecodeError, MessageContext } from './codec';
