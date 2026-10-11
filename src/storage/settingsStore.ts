import AsyncStorage from '@react-native-async-storage/async-storage';
import { clampSeatCount, DEFAULT_SEATS } from '../networking/protocol/lobby';

export interface Settings {
  /** Seats the host offers when creating a game. Open seats become bots at start. */
  seatCount: number;
  /** Sound effects on or off. */
  soundEnabled: boolean;
}

const KEYS = {
  seatCount: 'settings.seatCount',
  soundEnabled: 'settings.soundEnabled',
} as const;

export const DEFAULT_SETTINGS: Settings = {
  seatCount: DEFAULT_SEATS,
  soundEnabled: true,
};

export async function loadSettings(): Promise<Settings> {
  const [rawSeats, rawSound] = await Promise.all([
    AsyncStorage.getItem(KEYS.seatCount),
    AsyncStorage.getItem(KEYS.soundEnabled),
  ]);
  const seats = rawSeats === null ? NaN : Number(rawSeats);
  return {
    seatCount: Number.isInteger(seats) ? clampSeatCount(seats) : DEFAULT_SEATS,
    soundEnabled:
      rawSound === null ? DEFAULT_SETTINGS.soundEnabled : rawSound === 'true',
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(
      KEYS.seatCount,
      String(clampSeatCount(settings.seatCount)),
    ),
    AsyncStorage.setItem(KEYS.soundEnabled, String(settings.soundEnabled)),
  ]);
}
