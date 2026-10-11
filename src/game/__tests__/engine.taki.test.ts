import { Color } from '../cards/Card';
import { legalMoves, reduce } from '../engine/GameEngine';
import { EngineEventType } from '../state/EngineEvent';
import { closeTaki, drawCard, playCard } from '../state/GameAction';
import { currentPlayerId, topCard } from '../state/GameState';
import { RuleViolationCode } from '../state/RuleViolation';
import {
  card,
  expectOk,
  expectViolation,
  handOf,
  makeState,
} from '../testing/fixtures';

const filler = () => [card.num(Color.Green, 1), card.num(Color.Green, 4)];

function openTaki() {
  const state = makeState({
    hands: [
      [
        card.taki(Color.Red, 'taki'),
        card.num(Color.Red, 5, 'red-5'),
        card.num(Color.Red, 7, 'red-7'),
        card.stop(Color.Red, 'red-stop'),
        card.plus(Color.Red, 'red-plus'),
        card.reverse(Color.Red, 'red-rev'),
        card.taki(Color.Red, 'taki-2'),
        card.num(Color.Blue, 7, 'blue-7'),
        card.wild('wild'),
      ],
      filler(),
      filler(),
    ],
    top: card.num(Color.Red, 3),
    drawPile: [card.num(Color.Yellow, 9)],
  });
  return expectOk(reduce(state, 'p1', playCard('taki')));
}

describe('TAKI sequence', () => {
  it('opens a sequence in the card colour and only offers that colour', () => {
    const { state, events } = openTaki();
    expect(events).toContainEqual({
      type: EngineEventType.TakiOpened,
      playerId: 'p1',
      color: Color.Red,
    });
    expect(state.phase).toMatchObject({
      kind: 'TakiSequence',
      playerId: 'p1',
      color: Color.Red,
      playedCount: 0,
    });
    expect(currentPlayerId(state)).toBe('p1');
    expect(legalMoves(state, 'p1')).toEqual({
      isYourTurn: true,
      playableCardIds: [
        'red-5',
        'red-7',
        'red-stop',
        'red-plus',
        'red-rev',
        'taki-2',
      ],
      canDraw: false,
      canCloseTaki: true,
      mustChooseColor: false,
    });
  });

  it('lets the player chain matching cards, then close explicitly', () => {
    let { state } = openTaki();
    state = expectOk(reduce(state, 'p1', playCard('red-5'))).state;
    state = expectOk(reduce(state, 'p1', playCard('red-7'))).state;
    expect(state.phase).toMatchObject({
      kind: 'TakiSequence',
      playedCount: 2,
      lastCardId: 'red-7',
    });
    expect(currentPlayerId(state)).toBe('p1');

    const { state: closed, events } = expectOk(
      reduce(state, 'p1', closeTaki()),
    );
    expect(events[0]).toEqual({
      type: EngineEventType.TakiClosed,
      playerId: 'p1',
      cardsPlayed: 2,
    });
    expect(currentPlayerId(closed)).toBe('p2');
    expect(topCard(closed).id).toBe('red-7');
    expect(closed.phase).toEqual({
      kind: 'AwaitingPlay',
      playerId: 'p2',
      afterPlus: false,
    });
  });

  it('rejects other colours, wild cards and drawing while the TAKI is open', () => {
    const { state } = openTaki();
    expectViolation(
      reduce(state, 'p1', playCard('blue-7')),
      RuleViolationCode.TakiColorMismatch,
    );
    expectViolation(
      reduce(state, 'p1', playCard('wild')),
      RuleViolationCode.TakiColorMismatch,
    );
    expectViolation(
      reduce(state, 'p1', drawCard()),
      RuleViolationCode.CannotDrawDuringTaki,
    );
    expectViolation(
      reduce(state, 'p2', playCard('green-1')),
      RuleViolationCode.NotYourTurn,
    );
  });

  it('can be closed immediately, passing the turn', () => {
    const { state } = openTaki();
    const { state: closed, events } = expectOk(
      reduce(state, 'p1', closeTaki()),
    );
    expect(events[0]).toEqual({
      type: EngineEventType.TakiClosed,
      playerId: 'p1',
      cardsPlayed: 0,
    });
    expect(currentPlayerId(closed)).toBe('p2');
  });

  it('applies the last card effect when closing: Stop skips', () => {
    let { state } = openTaki();
    state = expectOk(reduce(state, 'p1', playCard('red-5'))).state;
    state = expectOk(reduce(state, 'p1', playCard('red-stop'))).state;
    // Intermediate action cards do nothing yet: still p1's sequence.
    expect(currentPlayerId(state)).toBe('p1');
    const { state: closed, events } = expectOk(
      reduce(state, 'p1', closeTaki()),
    );
    expect(events).toContainEqual({
      type: EngineEventType.PlayerSkipped,
      playerId: 'p2',
    });
    expect(currentPlayerId(closed)).toBe('p3');
  });

  it('applies the last card effect when closing: Plus means play again', () => {
    let { state } = openTaki();
    state = expectOk(reduce(state, 'p1', playCard('red-plus'))).state;
    const { state: closed } = expectOk(reduce(state, 'p1', closeTaki()));
    expect(closed.phase).toEqual({
      kind: 'AwaitingPlay',
      playerId: 'p1',
      afterPlus: true,
    });
  });

  it('applies the last card effect when closing: Change Direction reverses', () => {
    let { state } = openTaki();
    state = expectOk(reduce(state, 'p1', playCard('red-rev'))).state;
    const { state: closed, events } = expectOk(
      reduce(state, 'p1', closeTaki()),
    );
    expect(events).toContainEqual({
      type: EngineEventType.DirectionChanged,
      direction: -1,
    });
    expect(currentPlayerId(closed)).toBe('p3');
  });

  it('treats a second TAKI card inside the sequence as a plain red card', () => {
    let { state } = openTaki();
    state = expectOk(reduce(state, 'p1', playCard('taki-2'))).state;
    expect(state.phase).toMatchObject({ kind: 'TakiSequence', playedCount: 1 });
    const { state: closed } = expectOk(reduce(state, 'p1', closeTaki()));
    expect(currentPlayerId(closed)).toBe('p2');
  });

  it('refuses to close when no TAKI is open', () => {
    const state = makeState({
      hands: [filler(), filler()],
      top: card.num(Color.Red, 3),
    });
    expectViolation(
      reduce(state, 'p1', closeTaki()),
      RuleViolationCode.NoTakiToClose,
    );
  });

  it('keeps the hand consistent through the sequence', () => {
    let { state } = openTaki();
    state = expectOk(reduce(state, 'p1', playCard('red-5'))).state;
    state = expectOk(reduce(state, 'p1', playCard('red-7'))).state;
    expect(handOf(state, 'p1').map(c => c.id)).toEqual([
      'red-stop',
      'red-plus',
      'red-rev',
      'taki-2',
      'blue-7',
      'wild',
    ]);
    expect(state.discardPile.map(c => c.id).slice(-3)).toEqual([
      'taki',
      'red-5',
      'red-7',
    ]);
  });
});
