import AsyncStorage from '@react-native-async-storage/async-storage';
import { clampSeatCount, DEFAULT_SEATS } from '../networking/protocol/lobby';

export interface Settings {
  /** Seats the host offers when creating a game. Open seats become bots at start. */
  seatCount: number;
}

const KEYS = {
  seatCount: 'settings.seatCount',
} as const;

export const DEFAULT_SETTINGS: Settings = { seatCount: DEFAULT_SEATS };

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEYS.seatCount);
  const parsed = raw === null ? NaN : Number(raw);
  return {
    seatCount: Number.isInteger(parsed)
      ? clampSeatCount(parsed)
      : DEFAULT_SEATS,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(
    KEYS.seatCount,
    String(clampSeatCount(settings.seatCount)),
  );
}
