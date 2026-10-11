import { Color } from '../cards/Card';
import { createGame, legalMoves, reduce } from '../engine/GameEngine';
import { EngineEventType } from '../state/EngineEvent';
import { drawCard, playCard } from '../state/GameAction';
import {
  legalMovesForView,
  projectForPlayer,
  redactEvent,
} from '../state/PlayerView';
import { card, expectOk, makeState } from '../testing/fixtures';

const players = [
  { id: 'p1', name: 'Ofir' },
  { id: 'p2', name: 'Daniel' },
  { id: 'p3', name: 'Amit' },
];

describe('projectForPlayer', () => {
  it('shows only the viewer hand and counts for everyone else', () => {
    const { state } = createGame({ gameId: 'g', players, seed: 11 });
    const view = projectForPlayer(state, 'p2');

    expect(view.you.playerId).toBe('p2');
    expect(view.you.hand).toEqual(state.players[1].hand);
    expect(view.players).toEqual([
      { id: 'p1', name: 'Ofir', seat: 0, cardCount: 8 },
      { id: 'p2', name: 'Daniel', seat: 1, cardCount: 8 },
      { id: 'p3', name: 'Amit', seat: 2, cardCount: 8 },
    ]);
    expect(view.drawPileCount).toBe(state.drawPile.length);
    expect(view.topCard).toEqual(state.discardPile[0]);

    const serialized = JSON.stringify(view);
    for (const other of [state.players[0], state.players[2]]) {
      for (const c of other.hand) {
        expect(serialized).not.toContain(`"${c.id}"`);
      }
    }
    for (const c of state.drawPile) {
      expect(serialized).not.toContain(`"${c.id}"`);
    }
  });

  it('carries the version and phase so a client can detect gaps', () => {
    const { state } = createGame({ gameId: 'g', players, seed: 11 });
    const view = projectForPlayer(state, 'p1');
    expect(view.version).toBe(state.version);
    expect(view.phase).toEqual(state.phase);
    expect(view.currentPlayerId).toBe('p1');
  });

  it('refuses an unknown viewer', () => {
    const { state } = createGame({ gameId: 'g', players, seed: 11 });
    expect(() => projectForPlayer(state, 'nobody')).toThrow();
  });
});

describe('legalMovesForView', () => {
  it('agrees with the engine for the viewer', () => {
    const state = makeState({
      hands: [
        [
          card.num(Color.Red, 5, 'red-5'),
          card.num(Color.Blue, 7, 'blue-7'),
          card.wild('wild'),
        ],
        [card.num(Color.Green, 1)],
      ],
      top: card.num(Color.Red, 3),
    });
    expect(legalMovesForView(projectForPlayer(state, 'p1'))).toEqual(
      legalMoves(state, 'p1'),
    );
    expect(legalMovesForView(projectForPlayer(state, 'p2'))).toEqual(
      legalMoves(state, 'p2'),
    );
  });
});

describe('redactEvent', () => {
  it('turns other players card lists into counts and keeps your own', () => {
    const { events } = createGame({ gameId: 'g', players, seed: 5 });
    const dealtToP1 = events.find(
      e => e.type === EngineEventType.HandDealt && e.playerId === 'p1',
    );
    if (!dealtToP1 || dealtToP1.type !== EngineEventType.HandDealt)
      throw new Error('missing event');

    expect(redactEvent(dealtToP1, 'p1')).toEqual({
      type: EngineEventType.HandDealt,
      playerId: 'p1',
      count: 8,
      cards: dealtToP1.cards,
    });
    expect(redactEvent(dealtToP1, 'p2')).toEqual({
      type: EngineEventType.HandDealt,
      playerId: 'p1',
      count: 8,
    });
  });

  it('redacts draws the same way and passes public events through untouched', () => {
    const state = makeState({
      hands: [[card.num(Color.Blue, 7)], [card.num(Color.Green, 1)]],
      top: card.num(Color.Red, 3),
      drawPile: [card.num(Color.Yellow, 9, 'y9')],
    });
    const { events } = expectOk(reduce(state, 'p1', drawCard()));
    const drawn = events[0];
    expect(redactEvent(drawn, 'p2')).toEqual({
      type: EngineEventType.CardsDrawn,
      playerId: 'p1',
      count: 1,
      reason: 'turn',
    });
    expect(redactEvent(drawn, 'p1')).toMatchObject({
      count: 1,
      cards: [expect.objectContaining({ id: 'y9' })],
    });

    const played = expectOk(
      reduce(
        makeState({
          hands: [
            [card.num(Color.Red, 5, 'red-5')],
            [card.num(Color.Green, 1), card.num(Color.Green, 2 as never)],
          ],
          top: card.num(Color.Red, 3),
        }),
        'p1',
        playCard('red-5'),
      ),
    ).events[0];
    expect(redactEvent(played, 'p2')).toBe(played);
  });
});
