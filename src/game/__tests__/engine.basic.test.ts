import { Color, cardColor, isNumberCard } from '../cards/Card';
import { createGame, legalMoves, reduce } from '../engine/GameEngine';
import { EngineEventType } from '../state/EngineEvent';
import { drawCard, playCard } from '../state/GameAction';
import { currentPlayerId, topCard } from '../state/GameState';
import { RuleViolationCode } from '../state/RuleViolation';
import {
  card,
  expectOk,
  expectViolation,
  handOf,
  makeState,
} from '../testing/fixtures';

const players = [
  { id: 'p1', name: 'Ofir' },
  { id: 'p2', name: 'Daniel' },
  { id: 'p3', name: 'Amit' },
];

describe('createGame', () => {
  it('deals eight cards each, opens on a number card and starts with seat 0', () => {
    const { state, events } = createGame({ gameId: 'g', players, seed: 42 });
    expect(state.players.map(p => p.hand.length)).toEqual([8, 8, 8]);
    expect(state.discardPile).toHaveLength(1);
    expect(isNumberCard(topCard(state))).toBe(true);
    expect(state.activeColor).toBe(cardColor(topCard(state)));
    expect(state.drawPile).toHaveLength(100 - 24 - 1);
    expect(state.phase).toEqual({
      kind: 'AwaitingPlay',
      playerId: 'p1',
      afterPlus: false,
    });
    expect(currentPlayerId(state)).toBe('p1');
    expect(state.direction).toBe(1);

    expect(events.map(e => e.type)).toEqual([
      EngineEventType.HandDealt,
      EngineEventType.HandDealt,
      EngineEventType.HandDealt,
      EngineEventType.GameStarted,
      EngineEventType.PhaseChanged,
    ]);
    expect(state.version).toBe(events.length);
  });

  it('is deterministic for the same seed and differs for another', () => {
    const a = createGame({ gameId: 'g', players, seed: 7 });
    const b = createGame({ gameId: 'g', players, seed: 7 });
    const c = createGame({ gameId: 'g', players, seed: 8 });
    expect(a.state).toEqual(b.state);
    expect(a.state.players[0].hand).not.toEqual(c.state.players[0].hand);
  });

  it('never deals a card twice', () => {
    const { state } = createGame({ gameId: 'g', players, seed: 3 });
    const all = [
      ...state.players.flatMap(p => p.hand),
      ...state.drawPile,
      ...state.discardPile,
    ];
    expect(new Set(all.map(c => c.id)).size).toBe(100);
  });

  it('honours a custom starting seat and refuses fewer than two players', () => {
    const { state } = createGame({
      gameId: 'g',
      players,
      seed: 1,
      startingSeat: 2,
    });
    expect(currentPlayerId(state)).toBe('p3');
    expect(() =>
      createGame({ gameId: 'g', players: players.slice(0, 1), seed: 1 }),
    ).toThrow();
  });
});

describe('normal play', () => {
  it('plays a card of the active colour and passes the turn', () => {
    const red5 = card.num(Color.Red, 5, 'red-5');
    const state = makeState({
      hands: [
        [red5, card.num(Color.Blue, 7, 'blue-7')],
        [card.num(Color.Green, 1)],
      ],
      top: card.num(Color.Red, 3),
    });
    const { state: next, events } = expectOk(
      reduce(state, 'p1', playCard('red-5')),
    );
    expect(topCard(next).id).toBe('red-5');
    expect(handOf(next, 'p1').map(c => c.id)).toEqual(['blue-7']);
    expect(currentPlayerId(next)).toBe('p2');
    expect(next.activeColor).toBe(Color.Red);
    expect(events.map(e => e.type)).toEqual([
      EngineEventType.CardPlayed,
      EngineEventType.PhaseChanged,
    ]);
    expect(next.version).toBe(2);
  });

  it('plays the same number in another colour and switches the active colour', () => {
    const state = makeState({
      hands: [
        [card.num(Color.Blue, 3, 'blue-3'), card.num(Color.Yellow, 8)],
        [card.num(Color.Green, 1)],
      ],
      top: card.num(Color.Red, 3),
    });
    const { state: next } = expectOk(reduce(state, 'p1', playCard('blue-3')));
    expect(next.activeColor).toBe(Color.Blue);
    expect(currentPlayerId(next)).toBe('p2');
  });

  it('plays the same action symbol in another colour', () => {
    const state = makeState({
      hands: [
        [card.stop(Color.Blue, 'blue-stop')],
        [card.num(Color.Green, 1)],
        [card.num(Color.Green, 2 as never)],
      ],
      top: card.stop(Color.Red),
    });
    expectOk(reduce(state, 'p1', playCard('blue-stop')));
  });

  it('rejects a card of the wrong colour and number without changing state', () => {
    const state = makeState({
      hands: [[card.num(Color.Blue, 7, 'blue-7')], [card.num(Color.Green, 1)]],
      top: card.num(Color.Red, 3),
    });
    const result = reduce(state, 'p1', playCard('blue-7'));
    expectViolation(result, RuleViolationCode.CardDoesNotMatch);
    expect(state.players[0].hand).toHaveLength(1);
    expect(state.version).toBe(0);
  });

  it('rejects a number card whose only match is the value of a different active colour', () => {
    // Top is a wild; active colour green. A Red 3 must not match a "3" that is not on top.
    const state = makeState({
      hands: [[card.num(Color.Red, 3, 'red-3')], [card.num(Color.Green, 1)]],
      top: card.wild(),
      activeColor: Color.Green,
    });
    expectViolation(
      reduce(state, 'p1', playCard('red-3')),
      RuleViolationCode.CardDoesNotMatch,
    );
  });

  it('rejects plays out of turn, unknown players and cards not in hand', () => {
    const state = makeState({
      hands: [
        [card.num(Color.Red, 5, 'red-5')],
        [card.num(Color.Red, 1, 'red-1')],
      ],
      top: card.num(Color.Red, 3),
    });
    expectViolation(
      reduce(state, 'p2', playCard('red-1')),
      RuleViolationCode.NotYourTurn,
    );
    expectViolation(
      reduce(state, 'ghost', playCard('red-1')),
      RuleViolationCode.UnknownPlayer,
    );
    expectViolation(
      reduce(state, 'p1', playCard('red-1')),
      RuleViolationCode.CardNotInHand,
    );
  });
});

describe('drawing', () => {
  it('draws one card and passes the turn', () => {
    const state = makeState({
      hands: [[card.num(Color.Blue, 7)], [card.num(Color.Green, 1)]],
      top: card.num(Color.Red, 3),
      drawPile: [
        card.num(Color.Yellow, 9, 'y9'),
        card.num(Color.Yellow, 8, 'y8'),
      ],
    });
    const { state: next, events } = expectOk(reduce(state, 'p1', drawCard()));
    expect(handOf(next, 'p1').map(c => c.id)).toContain('y9');
    expect(next.drawPile.map(c => c.id)).toEqual(['y8']);
    expect(currentPlayerId(next)).toBe('p2');
    expect(events[0]).toEqual({
      type: EngineEventType.CardsDrawn,
      playerId: 'p1',
      cards: [expect.objectContaining({ id: 'y9' })],
      reason: 'turn',
    });
  });

  it('reshuffles the discard pile under the top card when the draw pile is empty', () => {
    const under = [
      card.num(Color.Green, 1, 'g1'),
      card.num(Color.Green, 4, 'g4'),
    ];
    const state = makeState({
      hands: [[card.num(Color.Blue, 7)], [card.num(Color.Green, 1)]],
      top: card.num(Color.Red, 3, 'top'),
      discardUnder: under,
      drawPile: [],
    });
    const { state: next, events } = expectOk(reduce(state, 'p1', drawCard()));
    expect(events[0]).toEqual({
      type: EngineEventType.DeckReshuffled,
      drawPileCount: 2,
    });
    expect(next.discardPile.map(c => c.id)).toEqual(['top']);
    const drawnId = handOf(next, 'p1')[1].id;
    expect(['g1', 'g4']).toContain(drawnId);
    expect(next.drawPile).toHaveLength(1);
  });

  it('still passes the turn when there is nothing left to draw anywhere', () => {
    const state = makeState({
      hands: [[card.num(Color.Blue, 7)], [card.num(Color.Green, 1)]],
      top: card.num(Color.Red, 3),
      drawPile: [],
    });
    const { state: next, events } = expectOk(reduce(state, 'p1', drawCard()));
    expect(handOf(next, 'p1')).toHaveLength(1);
    expect(currentPlayerId(next)).toBe('p2');
    expect(events[0]).toEqual({
      type: EngineEventType.CardsDrawn,
      playerId: 'p1',
      cards: [],
      reason: 'turn',
    });
  });
});

describe('legalMoves', () => {
  it('lists playable cards and allows drawing on a normal turn', () => {
    const state = makeState({
      hands: [
        [
          card.num(Color.Red, 5, 'red-5'),
          card.num(Color.Blue, 3, 'blue-3'),
          card.num(Color.Blue, 7, 'blue-7'),
          card.wild('wild'),
        ],
        [card.num(Color.Green, 1)],
      ],
      top: card.num(Color.Red, 3),
    });
    expect(legalMoves(state, 'p1')).toEqual({
      isYourTurn: true,
      playableCardIds: ['red-5', 'blue-3', 'wild'],
      canDraw: true,
      canCloseTaki: false,
      mustChooseColor: false,
    });
    expect(legalMoves(state, 'p2').isYourTurn).toBe(false);
    expect(legalMoves(state, 'p2').playableCardIds).toEqual([]);
  });
});
