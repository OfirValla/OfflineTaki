import {
  ALL_COLORS,
  CardKind,
  Color,
  cardColor,
  chooseColor,
  closeTaki,
  drawCard,
  isNumberCard,
  playCard,
  type Card,
  type GameAction,
  type LegalMoves,
  type PlayerView,
} from '../../../game';

/** A bot sees exactly what a phone would see and answers with an ordinary action. */
export interface BotStrategy {
  chooseAction(view: PlayerView, moves: LegalMoves): GameAction;
}

/**
 * Plays sensibly without looking ahead: stick to the colour you hold most of, spend number
 * cards before action cards, keep wilds for when nothing else fits, never end on a Plus.
 * Deterministic for a given view, which keeps tests exact.
 */
export class HeuristicStrategy implements BotStrategy {
  chooseAction(view: PlayerView, moves: LegalMoves): GameAction {
    const hand = view.you.hand;
    const dominant = dominantColor(hand);

    if (moves.mustChooseColor) return chooseColor(dominant);

    const playable = hand.filter(c => moves.playableCardIds.includes(c.id));

    if (view.phase.kind === 'TakiSequence') {
      if (playable.length === 0) return closeTaki();
      // Numbers first; an action card played last carries its effect when the TAKI closes.
      const pick =
        playable.find(isNumberCard) ??
        playable.find(
          c => c.kind !== CardKind.Taki && c.kind !== CardKind.Plus,
        ) ??
        playable.find(c => c.kind !== CardKind.Plus || hand.length > 1) ??
        playable[0];
      return playCard(pick.id);
    }

    if (playable.length === 0) return drawCard();

    let best = playable[0];
    let bestScore = -Infinity;
    for (const c of playable) {
      const score = scoreCard(c, hand, dominant);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    return playCard(
      best.id,
      best.kind === CardKind.ChangeColor ? dominant : undefined,
    );
  }
}

function scoreCard(card: Card, hand: Card[], dominant: Color): number {
  let score = cardColor(card) === dominant ? 10 : 0;
  switch (card.kind) {
    case CardKind.Number:
      score += 5;
      break;
    case CardKind.Stop:
    case CardKind.ChangeDirection:
      score += 3;
      break;
    case CardKind.Plus:
      // A Plus as the last card forces a draw; otherwise it is a free extra play.
      score += hand.length > 1 ? 4 : -50;
      break;
    case CardKind.Taki:
      score += countOfColor(hand, card.color) >= 3 ? 9 : 1;
      break;
    case CardKind.ChangeColor:
      score -= 5;
      break;
  }
  return score;
}

export function dominantColor(hand: Card[]): Color {
  let best = Color.Red;
  let bestCount = -1;
  for (const color of ALL_COLORS) {
    const count = countOfColor(hand, color);
    if (count > bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}

function countOfColor(hand: Card[], color: Color): number {
  return hand.filter(c => cardColor(c) === color).length;
}
