import { Color } from '../cards/Card';
import { legalMoves, reduce } from '../engine/GameEngine';
import { NO_MOVES } from '../engine/legalMoves';
import { EngineEventType } from '../state/EngineEvent';
import { closeTaki, drawCard, playCard } from '../state/GameAction';
import { currentPlayerId } from '../state/GameState';
import { RuleViolationCode } from '../state/RuleViolation';
import {
  card,
  expectOk,
  expectViolation,
  handOf,
  makeState,
} from '../testing/fixtures';

describe('winning', () => {
  it('finishes the game when the last card is played', () => {
    const state = makeState({
      hands: [
        [card.num(Color.Red, 5, 'red-5')],
        [
          card.num(Color.Green, 1),
          card.num(Color.Green, 4),
          card.num(Color.Green, 6),
        ],
        [card.num(Color.Blue, 1)],
      ],
      top: card.num(Color.Red, 3),
    });
    const { state: next, events } = expectOk(
      reduce(state, 'p1', playCard('red-5')),
    );
    expect(next.phase).toEqual({
      kind: 'Finished',
      winnerId: 'p1',
      finishOrder: ['p1', 'p3', 'p2'],
    });
    expect(events.map(e => e.type)).toEqual([
      EngineEventType.CardPlayed,
      EngineEventType.GameFinished,
      EngineEventType.PhaseChanged,
    ]);
    expect(events[1]).toEqual({
      type: EngineEventType.GameFinished,
      winnerId: 'p1',
      finishOrder: ['p1', 'p3', 'p2'],
    });

    expectViolation(
      reduce(next, 'p2', drawCard()),
      RuleViolationCode.GameFinished,
    );
    expectViolation(
      reduce(next, 'p1', drawCard()),
      RuleViolationCode.GameFinished,
    );
    expect(legalMoves(next, 'p1')).toEqual(NO_MOVES);
  });

  it('does not let a Plus be the last card: the player draws instead', () => {
    const state = makeState({
      hands: [[card.plus(Color.Red, 'plus')], [card.num(Color.Green, 1)]],
      top: card.num(Color.Red, 3),
      drawPile: [card.num(Color.Yellow, 9, 'y9')],
    });
    const { state: next, events } = expectOk(
      reduce(state, 'p1', playCard('plus')),
    );
    expect(next.phase.kind).not.toBe('Finished');
    expect(events).toContainEqual({
      type: EngineEventType.CardsDrawn,
      playerId: 'p1',
      cards: [expect.objectContaining({ id: 'y9' })],
      reason: 'forced',
    });
    expect(handOf(next, 'p1').map(c => c.id)).toEqual(['y9']);
    expect(currentPlayerId(next)).toBe('p2');
  });

  it('lets a Plus win when the house rule is off', () => {
    const state = makeState({
      hands: [[card.plus(Color.Red, 'plus')], [card.num(Color.Green, 1)]],
      top: card.num(Color.Red, 3),
      drawPile: [card.num(Color.Yellow, 9)],
      rules: { cannotFinishOnPlus: false },
    });
    const { state: next } = expectOk(reduce(state, 'p1', playCard('plus')));
    expect(next.phase).toMatchObject({ kind: 'Finished', winnerId: 'p1' });
  });

  it('reshuffles the previous top card for the forced draw when the draw pile is empty', () => {
    const state = makeState({
      hands: [[card.plus(Color.Red, 'plus')], [card.num(Color.Green, 1)]],
      top: card.num(Color.Red, 3, 'old-top'),
      drawPile: [],
    });
    const { state: next, events } = expectOk(
      reduce(state, 'p1', playCard('plus')),
    );
    expect(events).toContainEqual({
      type: EngineEventType.DeckReshuffled,
      drawPileCount: 1,
    });
    expect(handOf(next, 'p1').map(c => c.id)).toEqual(['old-top']);
    expect(next.discardPile.map(c => c.id)).toEqual(['plus']);
    expect(next.phase.kind).not.toBe('Finished');
    expect(currentPlayerId(next)).toBe('p2');
  });

  it('finishes inside a TAKI sequence as soon as the hand is empty', () => {
    const state = makeState({
      hands: [
        [card.taki(Color.Red, 'taki'), card.num(Color.Red, 5, 'red-5')],
        [card.num(Color.Green, 1)],
      ],
      top: card.num(Color.Red, 3),
    });
    const opened = expectOk(reduce(state, 'p1', playCard('taki'))).state;
    const { state: next, events } = expectOk(
      reduce(opened, 'p1', playCard('red-5')),
    );
    expect(events.map(e => e.type)).toEqual([
      EngineEventType.CardPlayed,
      EngineEventType.TakiClosed,
      EngineEventType.GameFinished,
      EngineEventType.PhaseChanged,
    ]);
    expect(next.phase).toMatchObject({ kind: 'Finished', winnerId: 'p1' });
    expectViolation(
      reduce(next, 'p1', closeTaki()),
      RuleViolationCode.GameFinished,
    );
  });

  it('closing a TAKI on the TAKI card as the last card wins', () => {
    const state = makeState({
      hands: [[card.taki(Color.Red, 'taki')], [card.num(Color.Green, 1)]],
      top: card.num(Color.Red, 3),
    });
    const { state: next } = expectOk(reduce(state, 'p1', playCard('taki')));
    // Playing the TAKI emptied the hand: the sequence is closed and the game is over.
    expect(next.phase).toMatchObject({ kind: 'Finished', winnerId: 'p1' });
  });

  it('a forced draw after a Plus inside a TAKI closes the sequence and passes the turn', () => {
    const state = makeState({
      hands: [
        [card.taki(Color.Red, 'taki'), card.plus(Color.Red, 'plus')],
        [card.num(Color.Green, 1)],
      ],
      top: card.num(Color.Red, 3),
      drawPile: [card.num(Color.Yellow, 9, 'y9')],
    });
    const opened = expectOk(reduce(state, 'p1', playCard('taki'))).state;
    const { state: next, events } = expectOk(
      reduce(opened, 'p1', playCard('plus')),
    );
    expect(events.map(e => e.type)).toEqual([
      EngineEventType.CardPlayed,
      EngineEventType.CardsDrawn,
      EngineEventType.TakiClosed,
      EngineEventType.PhaseChanged,
    ]);
    expect(handOf(next, 'p1').map(c => c.id)).toEqual(['y9']);
    expect(currentPlayerId(next)).toBe('p2');
  });

  it('orders the finish table by remaining cards, then seat', () => {
    const state = makeState({
      hands: [
        [card.num(Color.Red, 5, 'red-5')],
        [card.num(Color.Green, 1), card.num(Color.Green, 4)],
        [card.num(Color.Blue, 1), card.num(Color.Blue, 4)],
        [card.num(Color.Yellow, 1)],
      ],
      top: card.num(Color.Red, 3),
    });
    const { state: next } = expectOk(reduce(state, 'p1', playCard('red-5')));
    expect(next.phase).toMatchObject({ finishOrder: ['p1', 'p4', 'p2', 'p3'] });
  });
});

describe('two-player edge cases', () => {
  it('lets a player chain Stop after Stop and keep the turn', () => {
    const state = makeState({
      hands: [
        [
          card.stop(Color.Red, 's1'),
          card.stop(Color.Red, 's2'),
          card.num(Color.Red, 4, 'red-4'),
          card.num(Color.Yellow, 8),
        ],
        [card.num(Color.Green, 1)],
      ],
      top: card.num(Color.Red, 3),
    });
    let next = expectOk(reduce(state, 'p1', playCard('s1'))).state;
    expect(currentPlayerId(next)).toBe('p1');
    next = expectOk(reduce(next, 'p1', playCard('s2'))).state;
    expect(currentPlayerId(next)).toBe('p1');
    next = expectOk(reduce(next, 'p1', playCard('red-4'))).state;
    expect(currentPlayerId(next)).toBe('p2');
  });

  it('a Stop as the last card wins outright', () => {
    const state = makeState({
      hands: [[card.stop(Color.Red, 'stop')], [card.num(Color.Green, 1)]],
      top: card.num(Color.Red, 3),
    });
    const { state: next } = expectOk(reduce(state, 'p1', playCard('stop')));
    expect(next.phase).toMatchObject({
      kind: 'Finished',
      winnerId: 'p1',
      finishOrder: ['p1', 'p2'],
    });
  });

  it('a Change Direction as the last card wins outright', () => {
    const state = makeState({
      hands: [[card.reverse(Color.Red, 'rev')], [card.num(Color.Green, 1)]],
      top: card.num(Color.Red, 3),
    });
    const { state: next } = expectOk(reduce(state, 'p1', playCard('rev')));
    expect(next.phase).toMatchObject({ kind: 'Finished', winnerId: 'p1' });
  });
});
