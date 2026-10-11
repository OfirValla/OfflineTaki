import {
  currentPlayerId,
  playCard,
  projectForPlayer,
  type GameState,
} from '../../game';
import {
  MessageType,
  PlayerKind,
  createMessage,
  encodeMessage,
} from '../protocol';
import { createTable, firstLegalAction } from '../testing/harness';

jest.setTimeout(30_000); // full games over the in-memory network take a few seconds

function engineOf(t: ReturnType<typeof createTable>): GameState {
  const engine = t.host.engineStateForTesting();
  if (!engine) throw new Error('no game running');
  return engine;
}

/** Every phone (and the host's own view) must show exactly what the host would project. */
function expectViewsConverged(t: ReturnType<typeof createTable>): void {
  const engine = engineOf(t);
  for (const [playerId, session] of t.sessions()) {
    const view = session.getState().game;
    expect(view).toEqual(projectForPlayer(engine, playerId));
    expect(session.getState().pendingActionId).toBeNull();
  }
}

/** Plays the game to the end with humans following `firstLegalAction`; bots play themselves. */
async function playToTheEnd(
  t: ReturnType<typeof createTable>,
  maxSteps = 3000,
): Promise<number> {
  let steps = 0;
  while (engineOf(t).phase.kind !== 'Finished') {
    await t.settle();
    if (engineOf(t).phase.kind === 'Finished') break;
    const playerId = currentPlayerId(engineOf(t));
    const session = t.sessions().get(playerId);
    if (!session)
      throw new Error(`No session for ${playerId} (bot should have acted)`);
    const view = session.getState().game;
    if (!view) throw new Error(`${playerId} has no view`);
    const action = firstLegalAction(view, session.legalMoves());
    if (!action) throw new Error(`${playerId} has no legal action`);
    await session.act(action);
    await t.settle();
    expectViewsConverged(t);
    if (++steps > maxSteps) throw new Error('game did not finish');
  }
  return steps;
}

describe('host/client synchronization', () => {
  it('deals a game and every view matches the host projection', async () => {
    const t = createTable({ seatCount: 3 });
    await t.host.startHosting();
    await t.joinClient('a', 'Daniel');
    await t.joinClient('b', 'Amit');
    await t.host.startGame();
    await t.settle();

    expect(engineOf(t).players.map(p => p.id)).toEqual([
      'p-host',
      'p-a',
      'p-b',
    ]);
    expectViewsConverged(t);
    const view = t.clients.get('a')?.session.getState().game;
    expect(view?.you.hand).toHaveLength(8);
    expect(JSON.stringify(view)).not.toContain(
      engineOf(t).players[0].hand[0].id,
    );
  });

  it('plays a whole game between three phones with views converging after every action', async () => {
    const t = createTable({ seatCount: 3, seed: 7 });
    await t.host.startHosting();
    await t.joinClient('a', 'Daniel');
    await t.joinClient('b', 'Amit');
    await t.host.startGame();
    await t.settle();

    const steps = await playToTheEnd(t);
    expect(steps).toBeGreaterThan(5);
    expect(engineOf(t).phase.kind).toBe('Finished');
    expectViewsConverged(t);
    for (const session of t.sessions().values()) {
      expect(session.getState().game?.phase.kind).toBe('Finished');
      expect(session.legalMoves().isYourTurn).toBe(false);
    }
  });

  it('refuses an illegal action with a reason and leaves the state unchanged', async () => {
    const t = createTable({ seatCount: 3 });
    await t.host.startHosting();
    const a = await t.joinClient('a', 'Daniel');
    await t.joinClient('b', 'Amit');
    await t.host.startGame();
    await t.settle();

    const before = engineOf(t).version;
    // It is the host's turn (seat 0); Daniel tries anyway.
    const card = a.session.getState().game?.you.hand[0];
    await a.session.act(playCard(card?.id ?? 'x'));
    await t.settle();

    expect(a.session.getState().lastRejection?.code).toBe('NOT_YOUR_TURN');
    expect(a.session.getState().pendingActionId).toBeNull();
    expect(engineOf(t).version).toBe(before);
    expectViewsConverged(t);
  });

  it('applies a retried action only once', async () => {
    const t = createTable({ seatCount: 2 });
    await t.host.startHosting();
    const a = await t.joinClient('a', 'Daniel');
    await t.host.startGame();
    await t.settle();

    // Host plays first so that it becomes Daniel's turn.
    const hostAction = firstLegalAction(
      t.host.getState().game!,
      t.host.legalMoves(),
    );
    if (!hostAction) throw new Error('host has no action');
    await t.host.act(hostAction);
    await t.settle();
    if (currentPlayerId(engineOf(t)) !== 'p-a') return; // the host kept the turn (Plus/Stop); nothing to test

    const moves = a.session.legalMoves();
    const action = firstLegalAction(a.session.getState().game!, moves);
    if (!action) throw new Error('no action');
    const message = createMessage(
      MessageType.GameAction,
      { gameId: t.host.getState().gameId, senderId: 'p-a' },
      { actionId: 'retry-1', action },
    );
    const before = engineOf(t).version;
    await a.transport.send('host', encodeMessage(message));
    await a.transport.send('host', encodeMessage(message));
    await t.settle();

    const after = engineOf(t).version;
    expect(after).toBeGreaterThan(before);
    // A second application would have advanced the version again or produced a rejection.
    expect(a.session.getState().lastRejection).toBeNull();
    expectViewsConverged(t);
  });

  it('catches up from the event log after a small gap', async () => {
    const t = createTable({ seatCount: 2 });
    await t.host.startHosting();
    await t.joinClient('a', 'Daniel');
    await t.host.startGame();
    await t.settle();

    t.net.dropNext('host', 'a', 1); // lose the first event of the host's next action
    const action = firstLegalAction(
      t.host.getState().game!,
      t.host.legalMoves(),
    );
    await t.host.act(action!);
    await t.settle();
    await new Promise<void>(resolve => setTimeout(() => resolve(), 30));
    await t.settle();

    expectViewsConverged(t);
  });

  it('falls back to a snapshot when the gap is too old for the event log', async () => {
    const t = createTable({ seatCount: 2, host: { eventLogCapacity: 1 } });
    await t.host.startHosting();
    await t.joinClient('a', 'Daniel');
    await t.host.startGame();
    await t.settle();

    t.net.dropNext('host', 'a', 1);
    const action = firstLegalAction(
      t.host.getState().game!,
      t.host.legalMoves(),
    );
    await t.host.act(action!);
    await t.settle();
    await new Promise<void>(resolve => setTimeout(() => resolve(), 30));
    await t.settle();

    expectViewsConverged(t);
  });

  it('retries the resync request if it gets lost', async () => {
    const t = createTable({ seatCount: 2 });
    await t.host.startHosting();
    await t.joinClient('a', 'Daniel');
    await t.host.startGame();
    await t.settle();

    t.net.dropNext('host', 'a', 1);
    t.net.dropNext('a', 'host', 1); // the first RESYNC_REQUEST disappears too
    const action = firstLegalAction(
      t.host.getState().game!,
      t.host.legalMoves(),
    );
    await t.host.act(action!);
    await t.settle();
    await new Promise<void>(resolve => setTimeout(() => resolve(), 60));
    await t.settle();

    expectViewsConverged(t);
  });

  it('lets a dropped player reclaim the same seat and cards mid-game', async () => {
    const t = createTable({ seatCount: 3 });
    await t.host.startHosting();
    const a = await t.joinClient('a', 'Daniel');
    const b = await t.joinClient('b', 'Amit');
    await t.host.startGame();
    await t.settle();
    const handBefore = engineOf(t).players[1].hand.map(c => c.id);
    const game = {
      peerId: 'host',
      transport: a.transport.capabilities.kind,
      lastSeenAt: 0,
      protocolVersion: 2,
      gameId: t.host.getState().gameId,
      gameName: t.host.getState().gameName,
      hostName: 'Ofir',
      playerCount: 3,
      maxPlayers: 3,
      requiresJoinCode: false,
    };

    t.net.breakLink('host', 'a');
    await t.settle();
    expect(a.session.getState().status).toBe('disconnected');
    expect(
      t.host.getState().peers.find(p => p.playerId === 'p-a')?.connected,
    ).toBe(false);
    expect(
      b.session.getState().peers.find(p => p.playerId === 'p-a')?.connected,
    ).toBe(false);
    expect(t.net.isAdvertising('host')).toBe(true);

    // The game goes on without Daniel: the host plays a card.
    const hostAction = firstLegalAction(
      t.host.getState().game!,
      t.host.legalMoves(),
    );
    await t.host.act(hostAction!);
    await t.settle();

    await a.session.join(game);
    await t.settle();

    expect(a.session.getState().status).toBe('joined');
    expect(
      t.host.getState().peers.find(p => p.playerId === 'p-a')?.connected,
    ).toBe(true);
    expect(
      b.session.getState().peers.find(p => p.playerId === 'p-a')?.connected,
    ).toBe(true);
    expect(engineOf(t).players[1].hand.map(c => c.id)).toEqual(handBefore);
    expect(t.net.isAdvertising('host')).toBe(false);
    expectViewsConverged(t);

    // And play continues normally afterwards.
    await playToTheEnd(t);
    expectViewsConverged(t);
  });

  it('rejects a reconnect with the wrong token', async () => {
    const t = createTable({ seatCount: 3 });
    await t.host.startHosting();
    await t.joinClient('a', 'Daniel');
    await t.host.startGame();
    await t.settle();
    t.net.breakLink('host', 'a');
    await t.settle();

    const impostor = t.makeClient('x', 'Impostor');
    await impostor.transport.connect('host');
    const hello = createMessage(
      MessageType.Hello,
      { gameId: t.host.getState().gameId, senderId: 'p-a' },
      {
        playerName: 'Impostor',
        protocolVersion: 2,
        appVersion: 'x',
        reconnect: { playerId: 'p-a', token: 'wrong-token-1234' },
      },
    );
    await impostor.transport.send('host', encodeMessage(hello));
    await t.settle();
    expect(
      t.host.getState().peers.find(p => p.playerId === 'p-a')?.connected,
    ).toBe(false);
    expect(t.net.isConnected('host', 'x')).toBe(false);
  });

  it('runs a game where bots fill the seats and never make an illegal move', async () => {
    const t = createTable({ seatCount: 4, seed: 99 });
    await t.host.startHosting();
    await t.host.startGame();
    await t.settle();

    expect(
      t.host.getState().peers.filter(p => p.kind === PlayerKind.Bot),
    ).toHaveLength(3);
    const steps = await playToTheEnd(t);
    expect(engineOf(t).phase.kind).toBe('Finished');
    expect(t.host.botFailures).toBe(0);
    expect(steps).toBeGreaterThan(0);
    expect(t.host.getState().game?.phase.kind).toBe('Finished');
  });

  it('deals a new round after a finished game', async () => {
    const t = createTable({ seatCount: 2, seed: 5 });
    await t.host.startHosting();
    const a = await t.joinClient('a', 'Daniel');
    await t.host.startGame();
    await t.settle();
    await playToTheEnd(t);

    await t.host.startGame();
    await t.settle();
    expect(engineOf(t).phase.kind).toBe('AwaitingPlay');
    expect(a.session.getState().game?.version).toBe(engineOf(t).version);
    expect(a.session.getState().game?.you.hand).toHaveLength(8);
    expectViewsConverged(t);
  });
});
