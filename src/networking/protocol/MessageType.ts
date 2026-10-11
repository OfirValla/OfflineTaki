export const PROTOCOL_VERSION = 2;

/** Every message type on the wire. */
export enum MessageType {
  // Lobby
  Hello = 'HELLO',
  HelloAck = 'HELLO_ACK',
  Rejected = 'REJECTED',
  LobbyState = 'LOBBY_STATE',
  Chat = 'CHAT',
  Reaction = 'REACTION',
  Ping = 'PING',
  Pong = 'PONG',
  // Game
  GameAction = 'GAME_ACTION',
  GameEvent = 'GAME_EVENT',
  StateSnapshot = 'STATE_SNAPSHOT',
  ActionRejected = 'ACTION_REJECTED',
  ResyncRequest = 'RESYNC_REQUEST',
}

export enum RejectReason {
  Full = 'FULL',
  VersionMismatch = 'VERSION_MISMATCH',
  NotHosting = 'NOT_HOSTING',
  GameStarted = 'GAME_STARTED',
  BadReconnect = 'BAD_RECONNECT',
}
