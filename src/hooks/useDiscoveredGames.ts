import { useEffect, useState } from 'react';
import type {
  DiscoveredGame,
  NearbyTransport,
} from '../networking/transport/types';

/** Games advertised nearby, kept fresh while `active`. Discovery stops when the hook unmounts. */
export function useDiscoveredGames(
  transport: NearbyTransport,
  active: boolean,
) {
  const [games, setGames] = useState<DiscoveredGame[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const unsubscribe = transport.subscribe(event => {
      if (event.type === 'gameFound') {
        setGames(current => [
          ...current.filter(g => g.peerId !== event.game.peerId),
          event.game,
        ]);
      } else if (event.type === 'gameLost') {
        setGames(current => current.filter(g => g.peerId !== event.peerId));
      } else if (event.type === 'error' && !event.peerId) {
        setError(event.message);
      }
    });
    transport.startDiscovery().catch(e => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelled = true;
      unsubscribe();
      void transport.stopDiscovery().catch(() => undefined);
    };
  }, [transport, active]);

  return { games, error };
}
