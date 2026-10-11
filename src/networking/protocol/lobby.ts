/**
 * Lobby rules shared by host, clients and UI: how many seats a game has and who fills them.
 * Seats the host leaves open when starting are taken by bots.
 */

export const MIN_SEATS = 2;
export const MAX_SEATS = 8;
export const DEFAULT_SEATS = 4;

export enum PlayerKind {
  Human = 'human',
  Bot = 'bot',
}

export enum LobbyPhase {
  /** Seats can still change; humans can still join. */
  Lobby = 'lobby',
  /** Roster is final (bots filled the open seats); nobody else can join. */
  Started = 'started',
}

/** Clamps a requested seat count to the allowed range and never below the humans present. */
export function clampSeatCount(requested: number, humansPresent = 0): number {
  const wanted = Number.isFinite(requested)
    ? Math.round(requested)
    : DEFAULT_SEATS;
  return Math.min(MAX_SEATS, Math.max(MIN_SEATS, humansPresent, wanted));
}
