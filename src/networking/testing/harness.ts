import {
  chooseColor,
  closeTaki,
  drawCard,
  playCard,
  type GameAction,
  type LegalMoves,
  type PlayerView,
} from '../../game';
import { GameClient, type GameClientOptions } from '../client/GameClient';
import { GameHost, type GameHostOptions } from '../host/GameHost';
import type { GameSession } from '../session/SessionState';
import {
  MemoryNetwork,
  type MemoryTransport,
} from '../transport/MemoryTransport';
import type { DiscoveredGame, TransportEvent } from '../transport/types';

/** A host plus any number of clients on one in-memory network, with helpers to drive a game. */

export const APP_VERSION = '0.3.0-test';

export interface TableOptions {
  seatCount?: number;
  seed?: number;
  host?: Partial<GameHostOptions>;
}

export function createTable(options: TableOptions = {}) {
  const net = new MemoryNetwork();
  const hostTransport = net.createTransport('host');
  const host = new GameHost(hostTransport, {
    self: { playerId: 'p-host', name: 'Ofir' },
    appVersion: APP_VERSION,
    gameId: '00000000-0000-4000-8000-00000000abcd',
    gameName: "Ofir's Game",
    seatCount: options.seatCount ?? 6,
    seed: () => options.seed ?? 42,
    botDelayMs: () => 0,
    rejectDisconnectDelayMs: 0,
    ...options.host,
  });

  const clients = new Map<
    string,
    { transport: MemoryTransport; session: GameClient }
  >();

  const makeClient = (
    id: string,
    name: string,
    extra: Partial<GameClientOptions> = {},
  ) => {
    const transport = net.createTransport(id);
    const session = new GameClient(transport, {
      self: { playerId: `p-${id}`, name },
      appVersion: APP_VERSION,
      joinTimeoutMs: 500,
      resyncRetryMs: 20,
      ...extra,
    });
    const entry = { transport, session };
    clients.set(id, entry);
    return entry;
  };

  /** Waits for the host's advertisement to reach `transport`. */
  const discover = async (
    transport: MemoryTransport,
  ): Promise<DiscoveredGame> => {
    const found = new Promise<DiscoveredGame>(resolve => {
      const unsubscribe = transport.subscribe((e: TransportEvent) => {
        if (e.type === 'gameFound') {
          unsubscribe();
          resolve(e.game);
        }
      });
    });
    await transport.startDiscovery();
    const game = await found;
    await transport.stopDiscovery();
    return game;
  };

  const joinClient = async (id: string, name: string) => {
    const entry = makeClient(id, name);
    await entry.session.join(await discover(entry.transport));
    await net.flush();
    return entry;
  };

  /** Lets bots act and messages arrive until nothing is pending. */
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 200; i++) {
      await net.flush();
      if (!host.botsPending()) {
        await net.flush();
        if (!host.botsPending()) return;
      }
      await host.botsIdle();
    }
    throw new Error('Table did not settle');
  };

  /** Every session keyed by player id, host included. */
  const sessions = (): Map<string, GameSession> => {
    const all = new Map<string, GameSession>([['p-host', host]]);
    for (const [id, { session }] of clients) all.set(`p-${id}`, session);
    return all;
  };

  return {
    net,
    host,
    hostTransport,
    clients,
    makeClient,
    discover,
    joinClient,
    settle,
    sessions,
  };
}

/** A plain policy for humans in tests: first playable card, else draw / close / pick a colour. */
export function firstLegalAction(
  view: PlayerView,
  moves: LegalMoves,
): GameAction | null {
  if (!moves.isYourTurn) return null;
  if (moves.mustChooseColor)
    return chooseColor(
      view.you.hand.find(c => 'color' in c)?.color ?? view.activeColor,
    );
  const first = moves.playableCardIds[0];
  if (first) {
    const card = view.you.hand.find(c => c.id === first);
    return playCard(
      first,
      card && !('color' in card) ? view.activeColor : undefined,
    );
  }
  if (moves.canCloseTaki) return closeTaki();
  if (moves.canDraw) return drawCard();
  return null;
}
