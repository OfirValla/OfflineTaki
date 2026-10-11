import { Color } from '../cards/Card';
import { legalMoves, reduce } from '../engine/GameEngine';
import { EngineEventType } from '../state/EngineEvent';
import { chooseColor, drawCard, playCard } from '../state/GameAction';
import { currentPlayerId } from '../state/GameState';
import { RuleViolationCode } from '../state/RuleViolation';
import {
  card,
  expectOk,
  expectViolation,
  makeState,
} from '../testing/fixtures';

const filler = () => [card.num(Color.Green, 1), card.num(Color.Green, 4)];

describe('Stop', () => {
  it('skips the next player with three players', () => {
    const state = makeState({
      hands: [[card.stop(Color.Red, 'stop'), ...filler()], filler(), filler()],
      top: card.num(Color.Red, 3),
    });
    const { state: next, events } = expectOk(
      reduce(state, 'p1', playCard('stop')),
    );
    expect(events).toContainEqual({
      type: EngineEventType.PlayerSkipped,
      playerId: 'p2',
    });
    expect(currentPlayerId(next)).toBe('p3');
  });

  it('gives the same player another turn with two players', () => {
    const state = makeState({
      hands: [[card.stop(Color.Red, 'stop'), ...filler()], filler()],
      top: card.num(Color.Red, 3),
    });
    const { state: next, events } = expectOk(
      reduce(state, 'p1', playCard('stop')),
    );
    expect(events).toContainEqual({
      type: EngineEventType.PlayerSkipped,
      playerId: 'p2',
    });
    expect(currentPlayerId(next)).toBe('p1');
    expect(next.phase).toEqual({
      kind: 'AwaitingPlay',
      playerId: 'p1',
      afterPlus: false,
    });
  });

  it('respects the direction when skipping', () => {
    const state = makeState({
      hands: [[card.stop(Color.Red, 'stop'), ...filler()], filler(), filler()],
      top: card.num(Color.Red, 3),
      direction: -1,
    });
    const { state: next } = expectOk(reduce(state, 'p1', playCard('stop')));
    expect(currentPlayerId(next)).toBe('p2'); // p1 -> skip p3 -> p2
  });
});

describe('Plus', () => {
  it('makes the same player play again', () => {
    const state = makeState({
      hands: [
        [
          card.plus(Color.Red, 'plus'),
          card.num(Color.Red, 4, 'red-4'),
          ...filler(),
        ],
        filler(),
      ],
      top: card.num(Color.Red, 3),
    });
    const afterPlus = expectOk(reduce(state, 'p1', playCard('plus'))).state;
    expect(afterPlus.phase).toEqual({
      kind: 'AwaitingPlay',
      playerId: 'p1',
      afterPlus: true,
    });
    expect(currentPlayerId(afterPlus)).toBe('p1');

    const afterSecond = expectOk(
      reduce(afterPlus, 'p1', playCard('red-4')),
    ).state;
    expect(currentPlayerId(afterSecond)).toBe('p2');
  });

  it('ends the turn if the player draws instead of playing the second card', () => {
    const state = makeState({
      hands: [
        [card.plus(Color.Red, 'plus'), card.num(Color.Blue, 7)],
        filler(),
      ],
      top: card.num(Color.Red, 3),
      drawPile: [card.num(Color.Yellow, 9)],
    });
    const afterPlus = expectOk(reduce(state, 'p1', playCard('plus'))).state;
    const { state: next } = expectOk(reduce(afterPlus, 'p1', drawCard()));
    expect(currentPlayerId(next)).toBe('p2');
    expect(next.players[0].hand).toHaveLength(2);
  });

  it('still lets the other player wait their turn', () => {
    const state = makeState({
      hands: [
        [card.plus(Color.Red, 'plus'), card.num(Color.Red, 4)],
        [card.num(Color.Red, 1, 'red-1')],
      ],
      top: card.num(Color.Red, 3),
    });
    const afterPlus = expectOk(reduce(state, 'p1', playCard('plus'))).state;
    expectViolation(
      reduce(afterPlus, 'p2', playCard('red-1')),
      RuleViolationCode.NotYourTurn,
    );
  });
});

describe('Change Direction', () => {
  it('reverses the order with three players', () => {
    const state = makeState({
      hands: [
        [card.reverse(Color.Red, 'rev'), ...filler()],
        filler(),
        filler(),
      ],
      top: card.num(Color.Red, 3),
    });
    const { state: next, events } = expectOk(
      reduce(state, 'p1', playCard('rev')),
    );
    expect(events).toContainEqual({
      type: EngineEventType.DirectionChanged,
      direction: -1,
    });
    expect(next.direction).toBe(-1);
    expect(currentPlayerId(next)).toBe('p3');

    // and back again from p3
    const p3rev = card.reverse(Color.Red, 'rev2');
    const state2 = {
      ...next,
      players: next.players.map(p =>
        p.id === 'p3' ? { ...p, hand: [p3rev, ...p.hand] } : p,
      ),
    };
    const { state: next2 } = expectOk(reduce(state2, 'p3', playCard('rev2')));
    expect(next2.direction).toBe(1);
    expect(currentPlayerId(next2)).toBe('p1');
  });

  it('acts as a Stop with two players (default rule)', () => {
    const state = makeState({
      hands: [[card.reverse(Color.Red, 'rev'), ...filler()], filler()],
      top: card.num(Color.Red, 3),
    });
    const { state: next, events } = expectOk(
      reduce(state, 'p1', playCard('rev')),
    );
    expect(events.map(e => e.type)).not.toContain(
      EngineEventType.DirectionChanged,
    );
    expect(events).toContainEqual({
      type: EngineEventType.PlayerSkipped,
      playerId: 'p2',
    });
    expect(next.direction).toBe(1);
    expect(currentPlayerId(next)).toBe('p1');
  });

  it('can be configured to reverse even with two players', () => {
    const state = makeState({
      hands: [[card.reverse(Color.Red, 'rev'), ...filler()], filler()],
      top: card.num(Color.Red, 3),
      rules: { twoPlayerReverseActsAsStop: false },
    });
    const { state: next, events } = expectOk(
      reduce(state, 'p1', playCard('rev')),
    );
    expect(events).toContainEqual({
      type: EngineEventType.DirectionChanged,
      direction: -1,
    });
    expect(currentPlayerId(next)).toBe('p2');
  });
});

describe('Change Color', () => {
  it('waits for a colour, then applies it and passes the turn', () => {
    const state = makeState({
      hands: [
        [card.wild('wild'), card.num(Color.Red, 4, 'red-4')],
        [card.num(Color.Blue, 9, 'blue-9')],
      ],
      top: card.num(Color.Red, 3),
    });
    const pending = expectOk(reduce(state, 'p1', playCard('wild'))).state;
    expect(pending.phase).toEqual({
      kind: 'AwaitingColorChoice',
      playerId: 'p1',
    });
    expect(legalMoves(pending, 'p1')).toMatchObject({
      isYourTurn: true,
      mustChooseColor: true,
      canDraw: false,
      playableCardIds: [],
    });

    expectViolation(
      reduce(pending, 'p1', playCard('red-4')),
      RuleViolationCode.MustChooseColor,
    );
    expectViolation(
      reduce(pending, 'p1', drawCard()),
      RuleViolationCode.MustChooseColor,
    );
    expectViolation(
      reduce(pending, 'p2', chooseColor(Color.Blue)),
      RuleViolationCode.NotYourTurn,
    );

    const { state: next, events } = expectOk(
      reduce(pending, 'p1', chooseColor(Color.Blue)),
    );
    expect(events[0]).toEqual({
      type: EngineEventType.ColorChosen,
      playerId: 'p1',
      color: Color.Blue,
    });
    expect(next.activeColor).toBe(Color.Blue);
    expect(currentPlayerId(next)).toBe('p2');

    // The next player must follow the chosen colour, not the wild card.
    expectOk(reduce(next, 'p2', playCard('blue-9')));
  });

  it('accepts the colour together with the play as a shortcut', () => {
    const state = makeState({
      hands: [
        [card.wild('wild'), card.num(Color.Red, 4)],
        [card.num(Color.Red, 1, 'red-1')],
      ],
      top: card.num(Color.Red, 3),
    });
    const { state: next, events } = expectOk(
      reduce(state, 'p1', playCard('wild', Color.Green)),
    );
    expect(next.activeColor).toBe(Color.Green);
    expect(currentPlayerId(next)).toBe('p2');
    expect(events.map(e => e.type)).toEqual([
      EngineEventType.CardPlayed,
      EngineEventType.ColorChosen,
      EngineEventType.PhaseChanged,
    ]);
    expectViolation(
      reduce(next, 'p2', playCard('red-1')),
      RuleViolationCode.CardDoesNotMatch,
    );
  });

  it('can be played on anything, and a colour choice is refused when none is pending', () => {
    const state = makeState({
      hands: [[card.wild('wild')], [card.num(Color.Red, 1)]],
      top: card.stop(Color.Blue),
      activeColor: Color.Blue,
    });
    expectViolation(
      reduce(state, 'p1', chooseColor(Color.Red)),
      RuleViolationCode.ColorChoiceNotExpected,
    );
    expect(legalMoves(state, 'p1').playableCardIds).toEqual(['wild']);
  });
});
