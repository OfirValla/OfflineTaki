import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuid } from '../utils/ids';

export interface Profile {
  /** Stable per-install player id. Survives restarts; used for reconnects later. */
  playerId: string;
  playerName: string;
}

const KEYS = {
  playerId: 'profile.playerId',
  playerName: 'profile.playerName',
} as const;

export const MAX_PLAYER_NAME_LENGTH = 20;

export async function loadProfile(): Promise<Profile> {
  const [storedId, storedName] = await Promise.all([
    AsyncStorage.getItem(KEYS.playerId),
    AsyncStorage.getItem(KEYS.playerName),
  ]);
  let playerId = storedId ?? '';
  if (!playerId) {
    playerId = uuid();
    await AsyncStorage.setItem(KEYS.playerId, playerId);
  }
  return { playerId, playerName: storedName ?? '' };
}

export async function savePlayerName(name: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.playerName, normalizePlayerName(name));
}

export function normalizePlayerName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_PLAYER_NAME_LENGTH);
}
