import { useEffect, useRef } from 'react';
import { EngineEventType } from '../game';
import type { GameSession } from '../networking/session/SessionState';
import { soundPlayer } from '../platform/sound/SoundPlayer';
import { soundsForEvent } from '../platform/sound/soundEvents';

/** Turns a session's events into sound effects while `enabled`. */
export function useGameSounds(
  session: GameSession | null,
  enabled: boolean,
): void {
  const previousCurrent = useRef<string | null>(null);

  useEffect(() => {
    soundPlayer.preload();
  }, []);

  useEffect(() => {
    soundPlayer.setEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    if (!session) return;
    previousCurrent.current = session.getState().game?.currentPlayerId ?? null;
    const me = session.getState().self.playerId;
    return session.subscribeEvents(event => {
      const sounds = soundsForEvent(event, {
        me,
        previousCurrentPlayerId: previousCurrent.current,
      });
      if (
        event.type === 'game' &&
        event.event.type === EngineEventType.PhaseChanged
      ) {
        previousCurrent.current = event.event.currentPlayerId;
      }
      for (const sound of sounds) soundPlayer.play(sound);
    });
  }, [session]);
}
