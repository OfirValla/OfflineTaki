import { useSessionApi } from './SessionContext';
import { useGameSounds } from '../hooks/useGameSounds';

/** Invisible: keeps the sound effects wired to whatever session is active. */
export function SoundController() {
  const { session, settings } = useSessionApi();
  useGameSounds(session, settings.soundEnabled);
  return null;
}
