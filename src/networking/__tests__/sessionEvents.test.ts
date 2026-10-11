import { EngineEventType } from '../../game';
import type { SessionEvent } from '../session/SessionState';
import { createTable, firstLegalAction } from '../testing/harness';

/** Sounds and animations hang off these events, so both sides must emit them faithfully. */
describe('session events', () => {
  it('reports joins, the start, every applied game event and rejections', async () => {
    const t = createTable({ seatCount: 3, seed: 3 });
    const hostEvents: SessionEvent[] = [];
    t.host.subscribeEvents(e => hostEvents.push(e));
    await t.host.startHosting();

    const a = await t.joinClient('a', 'Daniel');
    const clientEvents: SessionEvent[] = [];
    a.session.subscribeEvents(e => clientEvents.push(e));
    await t.joinClient('b', 'Amit');
    await t.settle();

    expect(
      hostEvents
        .filter(e => e.type === 'peerJoined')
        .map(e => (e as { name: string }).name),
    ).toEqual(['Daniel', 'Amit']);
    expect(clientEvents).toContainEqual({ type: 'peerJoined', name: 'Amit' });

    await t.host.startGame();
    await t.settle();
    expect(hostEvents).toContainEqual({ type: 'gameStarted' });
    expect(clientEvents).toContainEqual({ type: 'gameStarted' });
    // The deal reaches the host as events (it owns them) but the client as a snapshot.
    expect(
      hostEvents.some(
        e => e.type === 'game' && e.event.type === EngineEventType.HandDealt,
      ),
    ).toBe(true);

    // Daniel acts out of turn: a rejection event on his side only.
    const card = a.session.getState().game!.you.hand[0];
    await a.session.act({ type: 'PLAY_CARD', cardId: card.id } as never);
    await t.settle();
    expect(clientEvents.filter(e => e.type === 'actionRejected')).toHaveLength(
      1,
    );

    // The host plays: the client receives exactly the events the host applied, in order.
    const before = clientEvents.length;
    const action = firstLegalAction(
      t.host.getState().game!,
      t.host.legalMoves(),
    );
    await t.host.act(action!);
    await t.settle();
    const received = clientEvents.slice(before).filter(e => e.type === 'game');
    expect(received.length).toBeGreaterThan(0);
    expect(received[0]).toMatchObject({
      type: 'game',
      event: { type: EngineEventType.CardPlayed },
    });
    expect(received.at(-1)).toMatchObject({
      type: 'game',
      event: { type: EngineEventType.PhaseChanged },
    });
  });
});
