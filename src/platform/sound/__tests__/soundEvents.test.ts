import {
  CardKind,
  Color,
  EngineEventType,
  type ClientEvent,
} from '../../../game';
import { SoundName, soundsForEvent } from '../soundEvents';

const ctx = (previous: string | null = 'p2') => ({
  me: 'p1',
  previousCurrentPlayerId: previous,
});
const game = (event: ClientEvent) => ({ type: 'game' as const, event });

describe('soundsForEvent', () => {
  it('plays a snap for any card and a zap for Stop, Plus and Change Direction', () => {
    const number: ClientEvent = {
      type: EngineEventType.CardPlayed,
      playerId: 'p2',
      card: { id: 'r7', kind: CardKind.Number, color: Color.Red, value: 7 },
      activeColor: Color.Red,
    };
    const stop: ClientEvent = {
      ...number,
      card: { id: 's', kind: CardKind.Stop, color: Color.Red },
    };
    expect(soundsForEvent(game(number), ctx())).toEqual([SoundName.CardPlay]);
    expect(soundsForEvent(game(stop), ctx())).toEqual([
      SoundName.CardPlay,
      SoundName.Special,
    ]);
  });

  it('announces my turn only when the turn moves to me', () => {
    const toMe: ClientEvent = {
      type: EngineEventType.PhaseChanged,
      phase: { kind: 'AwaitingPlay', playerId: 'p1', afterPlus: false },
      currentPlayerId: 'p1',
      direction: 1,
    };
    expect(soundsForEvent(game(toMe), ctx('p2'))).toEqual([SoundName.YourTurn]);
    expect(soundsForEvent(game(toMe), ctx('p1'))).toEqual([]); // still my turn after a Plus or TAKI play
    const toOther: ClientEvent = {
      ...toMe,
      currentPlayerId: 'p2',
      phase: { kind: 'AwaitingPlay', playerId: 'p2', afterPlus: false },
    };
    expect(soundsForEvent(game(toOther), ctx('p1'))).toEqual([]);
  });

  it('is silent on the finishing phase change but plays win or lose on the result', () => {
    const finishedPhase: ClientEvent = {
      type: EngineEventType.PhaseChanged,
      phase: { kind: 'Finished', winnerId: 'p1', finishOrder: ['p1', 'p2'] },
      currentPlayerId: 'p1',
      direction: 1,
    };
    expect(soundsForEvent(game(finishedPhase), ctx('p2'))).toEqual([]);
    expect(
      soundsForEvent(
        game({
          type: EngineEventType.GameFinished,
          winnerId: 'p1',
          finishOrder: ['p1', 'p2'],
        }),
        ctx(),
      ),
    ).toEqual([SoundName.Win]);
    expect(
      soundsForEvent(
        game({
          type: EngineEventType.GameFinished,
          winnerId: 'p2',
          finishOrder: ['p2', 'p1'],
        }),
        ctx(),
      ),
    ).toEqual([SoundName.Lose]);
  });

  it('plays the deal only for my own hand and draws only when something was drawn', () => {
    expect(
      soundsForEvent(
        game({ type: EngineEventType.HandDealt, playerId: 'p1', count: 8 }),
        ctx(),
      ),
    ).toEqual([SoundName.Start]);
    expect(
      soundsForEvent(
        game({ type: EngineEventType.HandDealt, playerId: 'p2', count: 8 }),
        ctx(),
      ),
    ).toEqual([]);
    expect(
      soundsForEvent(
        game({
          type: EngineEventType.CardsDrawn,
          playerId: 'p2',
          count: 1,
          reason: 'turn',
        }),
        ctx(),
      ),
    ).toEqual([SoundName.CardDraw]);
    expect(
      soundsForEvent(
        game({
          type: EngineEventType.CardsDrawn,
          playerId: 'p2',
          count: 0,
          reason: 'turn',
        }),
        ctx(),
      ),
    ).toEqual([]);
  });

  it('maps TAKI, colour choice, joins and rejections', () => {
    expect(
      soundsForEvent(
        game({
          type: EngineEventType.TakiOpened,
          playerId: 'p2',
          color: Color.Blue,
        }),
        ctx(),
      ),
    ).toEqual([SoundName.Taki]);
    expect(
      soundsForEvent(
        game({
          type: EngineEventType.ColorChosen,
          playerId: 'p2',
          color: Color.Blue,
        }),
        ctx(),
      ),
    ).toEqual([SoundName.Color]);
    expect(
      soundsForEvent({ type: 'peerJoined', name: 'Daniel' }, ctx()),
    ).toEqual([SoundName.Join]);
    expect(
      soundsForEvent({ type: 'actionRejected', code: 'NOT_YOUR_TURN' }, ctx()),
    ).toEqual([SoundName.Reject]);
    expect(soundsForEvent({ type: 'gameStarted' }, ctx())).toEqual([]);
  });
});
