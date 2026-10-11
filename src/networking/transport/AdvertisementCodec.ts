import type { GameAdvertisement } from './types';

/**
 * Packs a GameAdvertisement into the short string a transport can put on the air (the Nearby
 * `endpointName`, later a BLE local name) and back.
 *
 * Layout, `|`-separated:
 *   TK | protocolVersion | gameId (32 hex, no dashes) | gameName | hostName | count | max | flags
 *
 * Names are truncated and stripped of the separator so the frame always parses.
 */

const PREFIX = 'TK';
const SEPARATOR = '|';
const MAX_NAME_LENGTH = 20;
const FLAG_JOIN_CODE = 'c';
const FLAG_NONE = '-';

export function encodeAdvertisement(ad: GameAdvertisement): string {
  return [
    PREFIX,
    String(ad.protocolVersion),
    compactGameId(ad.gameId),
    sanitizeName(ad.gameName),
    sanitizeName(ad.hostName),
    String(ad.playerCount),
    String(ad.maxPlayers),
    ad.requiresJoinCode ? FLAG_JOIN_CODE : FLAG_NONE,
  ].join(SEPARATOR);
}

export function decodeAdvertisement(raw: string): GameAdvertisement | null {
  const parts = raw.split(SEPARATOR);
  if (parts.length !== 8 || parts[0] !== PREFIX) return null;

  const protocolVersion = Number(parts[1]);
  const gameId = expandGameId(parts[2]);
  const playerCount = Number(parts[5]);
  const maxPlayers = Number(parts[6]);
  if (!Number.isInteger(protocolVersion) || protocolVersion < 1) return null;
  if (gameId === null) return null;
  if (!Number.isInteger(playerCount) || !Number.isInteger(maxPlayers))
    return null;
  if (playerCount < 0 || maxPlayers < 1) return null;
  if (!parts[3] || !parts[4]) return null;

  return {
    protocolVersion,
    gameId,
    gameName: parts[3],
    hostName: parts[4],
    playerCount,
    maxPlayers,
    requiresJoinCode: parts[7] === FLAG_JOIN_CODE,
  };
}

export function sanitizeName(name: string): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .split(SEPARATOR)
    .join('/')
    .trim();
  const truncated = Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join('');
  return truncated.length > 0 ? truncated : '?';
}

function compactGameId(gameId: string): string {
  return gameId.replace(/-/g, '').toLowerCase();
}

function expandGameId(compact: string): string | null {
  if (!/^[0-9a-f]{32}$/.test(compact)) return null;
  return (
    compact.slice(0, 8) +
    '-' +
    compact.slice(8, 12) +
    '-' +
    compact.slice(12, 16) +
    '-' +
    compact.slice(16, 20) +
    '-' +
    compact.slice(20)
  );
}
