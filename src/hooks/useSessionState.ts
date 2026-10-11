import { useSyncExternalStore } from 'react';
import type {
  GameSession,
  SessionState,
} from '../networking/session/SessionState';

const noop = () => () => {};

/** Subscribes a component to a session's state with React's external-store protocol. */
export function useSessionState(
  session: GameSession | null,
): SessionState | null {
  return useSyncExternalStore(
    session ? listener => session.subscribe(listener) : noop,
    () => (session ? session.getState() : null),
    () => (session ? session.getState() : null),
  );
}
