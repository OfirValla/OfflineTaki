import { CardKind, EngineEventType, type ClientEvent } from '../../game';
import type { SessionEvent } from '../../networking/session/SessionState';

/** Every effect the app can play. Values are the resource names under android/app/src/main/res/raw. */
export enum SoundName {
  CardPlay = 'sfx_card_play',
  CardDraw = 'sfx_card_draw',
  YourTurn = 'sfx_your_turn',
  Taki = 'sfx_taki',
  Special = 'sfx_special',
  Color = 'sfx_color',
  Reject = 'sfx_reject',
  Win = 'sfx_win',
  Lose = 'sfx_lose',
  Join = 'sfx_join',
  Start = 'sfx_start',
  Tap = 'sfx_tap',
  Reaction = 'sfx_reaction',
}

export const ALL_SOUNDS: readonly SoundName[] = Object.values(SoundName);

export interface SoundContext {
  /** This device's player id. */
  me: string;
  /** Who was on turn before this event, so "your turn" plays only on the change. */
  previousCurrentPlayerId: string | null;
}

/**
 * Pure mapping from what happened to what should be heard. Kept free of React Native so it can
 * be unit-tested; the player that actually makes noise lives in SoundPlayer.
 */
export function soundsForEvent(
  event: SessionEvent,
  context: SoundContext,
): SoundName[] {
  switch (event.type) {
    case 'peerJoined':
      return [SoundName.Join];
    case 'actionRejected':
      return [SoundName.Reject];
    case 'gameStarted':
      return [];
    case 'reaction':
      return [SoundName.Reaction];
    case 'game':
      return soundsForGameEvent(event.event, context);
  }
}

function soundsForGameEvent(
  event: ClientEvent,
  context: SoundContext,
): SoundName[] {
  switch (event.type) {
    case EngineEventType.HandDealt:
      return event.playerId === context.me ? [SoundName.Start] : [];
    case EngineEventType.CardPlayed:
      switch (event.card.kind) {
        case CardKind.Stop:
        case CardKind.Plus:
        case CardKind.ChangeDirection:
          return [SoundName.CardPlay, SoundName.Special];
        default:
          return [SoundName.CardPlay];
      }
    case EngineEventType.CardsDrawn:
      return event.count > 0 ? [SoundName.CardDraw] : [];
    case EngineEventType.TakiOpened:
      return [SoundName.Taki];
    case EngineEventType.ColorChosen:
      return [SoundName.Color];
    case EngineEventType.PhaseChanged:
      return event.phase.kind !== 'Finished' &&
        event.currentPlayerId === context.me &&
        context.previousCurrentPlayerId !== context.me
        ? [SoundName.YourTurn]
        : [];
    case EngineEventType.GameFinished:
      return [event.winnerId === context.me ? SoundName.Win : SoundName.Lose];
    default:
      return [];
  }
}
