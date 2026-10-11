import { EngineEventType, type ClientEvent, type PlayerView } from '../../game';

/**
 * Advances a player's view by one redacted event. Pure, and exact: after applying every event
 * the host emitted, the view equals what the host would project for this player.
 */
export function applyClientEvent(
  view: PlayerView,
  event: ClientEvent,
  version: number,
): PlayerView {
  const me = view.you.playerId;
  const next: PlayerView = { ...view, version };

  switch (event.type) {
    case EngineEventType.GameStarted:
      return {
        ...next,
        topCard: event.topCard,
        activeColor: event.activeColor,
      };

    case EngineEventType.HandDealt:
      return {
        ...next,
        players: withCardCount(next.players, event.playerId, () => event.count),
        you:
          event.playerId === me && event.cards
            ? { ...next.you, hand: event.cards.slice() }
            : next.you,
      };

    case EngineEventType.CardPlayed:
      return {
        ...next,
        topCard: event.card,
        activeColor: event.activeColor,
        discardPileCount: next.discardPileCount + 1,
        players: withCardCount(next.players, event.playerId, n => n - 1),
        you:
          event.playerId === me
            ? {
                ...next.you,
                hand: next.you.hand.filter(c => c.id !== event.card.id),
              }
            : next.you,
      };

    case EngineEventType.CardsDrawn:
      return {
        ...next,
        drawPileCount: Math.max(0, next.drawPileCount - event.count),
        players: withCardCount(
          next.players,
          event.playerId,
          n => n + event.count,
        ),
        you:
          event.playerId === me && event.cards
            ? { ...next.you, hand: [...next.you.hand, ...event.cards] }
            : next.you,
      };

    case EngineEventType.ColorChosen:
      return { ...next, activeColor: event.color };

    case EngineEventType.DirectionChanged:
      return { ...next, direction: event.direction };

    case EngineEventType.DeckReshuffled:
      return {
        ...next,
        drawPileCount: event.drawPileCount,
        discardPileCount: 1,
      };

    case EngineEventType.PhaseChanged:
      return {
        ...next,
        phase: event.phase,
        currentPlayerId: event.currentPlayerId,
        direction: event.direction,
      };

    case EngineEventType.PlayerSkipped:
    case EngineEventType.TakiOpened:
    case EngineEventType.TakiClosed:
    case EngineEventType.GameFinished:
      return next;
  }
}

function withCardCount(
  players: PlayerView['players'],
  playerId: string,
  compute: (current: number) => number,
): PlayerView['players'] {
  return players.map(p =>
    p.id === playerId
      ? { ...p, cardCount: Math.max(0, compute(p.cardCount)) }
      : p,
  );
}
