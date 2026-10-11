import { err, ok, type Result } from '../../utils/Result';
import {
  CardKind,
  cardColor,
  describeCard,
  isNumberCard,
  type Card,
  type Color,
} from '../cards/Card';
import { buildDeck } from '../cards/deck';
import type { TurnResolution } from '../rules/CardEffectHandler';
import { handlerFor } from '../rules/handlers';
import { resolveRules, type RuleSet } from '../rules/RuleSet';
import {
  EngineEventType,
  type DrawReason,
  type EngineEvent,
} from '../state/EngineEvent';
import { GameActionType, type GameAction } from '../state/GameAction';
import {
  currentPlayerId,
  topCard,
  type Direction,
  type GamePhase,
  type GameState,
  type PlayerState,
} from '../state/GameState';
import {
  RuleViolationCode,
  violation,
  type RuleViolation,
} from '../state/RuleViolation';
import { computeLegalMoves, type LegalMoves } from './legalMoves';
import { createRng, shuffle } from './rng';

/**
 * The TAKI engine: pure functions from (state, action) to (state, events). No I/O, no timers,
 * no knowledge of phones or bots. The host calls `reduce`; everything else observes events.
 */

export interface CreateGameOptions {
  gameId: string;
  players: Array<{ id: string; name: string }>;
  seed: number;
  rules?: Partial<RuleSet>;
  /** Seat index of the player who opens the game. Defaults to seat 0. */
  startingSeat?: number;
}

export interface EngineResult {
  state: GameState;
  events: EngineEvent[];
}

export type ReduceResult = Result<EngineResult, RuleViolation>;

const MIN_PLAYERS = 2;

export function createGame(options: CreateGameOptions): EngineResult {
  if (options.players.length < MIN_PLAYERS) {
    throw new Error(`A game needs at least ${MIN_PLAYERS} players`);
  }
  const rules = resolveRules(options.rules);
  const shuffled = shuffle(buildDeck(rules.deck), createRng(options.seed));
  let drawPile = shuffled.items;
  const events: EngineEvent[] = [];

  const players: PlayerState[] = options.players.map((p, seat) => ({
    id: p.id,
    name: p.name,
    seat,
    hand: [],
  }));
  for (const player of players) {
    player.hand = drawPile.slice(0, rules.initialHandSize);
    drawPile = drawPile.slice(rules.initialHandSize);
    events.push({
      type: EngineEventType.HandDealt,
      playerId: player.id,
      cards: player.hand.slice(),
    });
  }

  // The opening card must be a number so that nobody suffers an effect before playing.
  const firstNumberIndex = drawPile.findIndex(isNumberCard);
  if (firstNumberIndex < 0)
    throw new Error('Deck has no number card to open with');
  const opening = drawPile[firstNumberIndex];
  drawPile = [
    ...drawPile.slice(0, firstNumberIndex),
    ...drawPile.slice(firstNumberIndex + 1),
  ];

  const startingSeat = options.startingSeat ?? 0;
  if (startingSeat < 0 || startingSeat >= players.length)
    throw new Error('startingSeat out of range');
  const starter = players[startingSeat];
  const activeColor = cardColor(opening) as Color;
  events.push({
    type: EngineEventType.GameStarted,
    startingPlayerId: starter.id,
    topCard: opening,
    activeColor,
  });

  const phase: GamePhase = {
    kind: 'AwaitingPlay',
    playerId: starter.id,
    afterPlus: false,
  };
  events.push({
    type: EngineEventType.PhaseChanged,
    phase,
    currentPlayerId: starter.id,
    direction: 1,
  });

  const state: GameState = {
    gameId: options.gameId,
    rules,
    phase,
    players,
    currentSeat: startingSeat,
    direction: 1,
    drawPile,
    discardPile: [opening],
    activeColor,
    rng: shuffled.next,
    version: events.length,
  };
  return { state, events };
}

export function legalMoves(state: GameState, playerId: string): LegalMoves {
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error(`Unknown player ${playerId}`);
  return computeLegalMoves({
    phase: state.phase,
    playerId,
    hand: player.hand,
    topCard: topCard(state),
    activeColor: state.activeColor,
  });
}

export function reduce(
  state: GameState,
  actorId: string,
  action: GameAction,
): ReduceResult {
  const actor = state.players.find(p => p.id === actorId);
  if (!actor)
    return err(
      violation(RuleViolationCode.UnknownPlayer, `Unknown player ${actorId}`),
    );
  if (state.phase.kind === 'Finished') {
    return err(violation(RuleViolationCode.GameFinished, 'The game is over'));
  }
  if (currentPlayerId(state) !== actorId) {
    return err(violation(RuleViolationCode.NotYourTurn, 'It is not your turn'));
  }

  switch (action.type) {
    case GameActionType.PlayCard:
      return playCard(state, actor, action.cardId, action.chosenColor);
    case GameActionType.DrawCard:
      return drawForTurn(state, actor);
    case GameActionType.ChooseColor:
      return chooseColor(state, actor, action.color);
    case GameActionType.CloseTaki:
      return closeTaki(state, actor);
    default:
      return err(violation(RuleViolationCode.UnknownAction, 'Unknown action'));
  }
}

// -------------------------------------------------------------------------------------------
// Actions
// -------------------------------------------------------------------------------------------

function playCard(
  state: GameState,
  actor: PlayerState,
  cardId: string,
  chosenColor?: Color,
): ReduceResult {
  const phase = state.phase;
  if (phase.kind === 'AwaitingColorChoice') {
    return err(
      violation(RuleViolationCode.MustChooseColor, 'Choose a colour first'),
    );
  }
  const card = actor.hand.find(c => c.id === cardId);
  if (!card)
    return err(
      violation(
        RuleViolationCode.CardNotInHand,
        'That card is not in your hand',
      ),
    );
  const handler = handlerFor(card);
  const top = topCard(state);

  if (
    phase.kind === 'AwaitingPlay' &&
    !handler.canPlay(card, top, state.activeColor)
  ) {
    return err(
      violation(
        RuleViolationCode.CardDoesNotMatch,
        `${describeCard(card)} cannot be played on ${describeCard(top)} (${
          state.activeColor
        })`,
      ),
    );
  }
  if (
    phase.kind === 'TakiSequence' &&
    !handler.canPlayInTaki(card, phase.color)
  ) {
    return err(
      violation(
        RuleViolationCode.TakiColorMismatch,
        `Only ${phase.color} cards can follow in this TAKI`,
      ),
    );
  }

  const events: EngineEvent[] = [];
  const nextActiveColor = cardColor(card) ?? chosenColor ?? state.activeColor;
  let next: GameState = {
    ...state,
    players: replacePlayer(state.players, {
      ...actor,
      hand: actor.hand.filter(c => c.id !== cardId),
    }),
    discardPile: [...state.discardPile, card],
    activeColor: nextActiveColor,
  };
  events.push({
    type: EngineEventType.CardPlayed,
    playerId: actor.id,
    card,
    activeColor: nextActiveColor,
  });

  const handEmpty = playerById(next, actor.id).hand.length === 0;
  if (
    handEmpty &&
    card.kind === CardKind.Plus &&
    state.rules.cannotFinishOnPlus
  ) {
    // A Plus cannot end the game: draw one instead, then the turn simply passes.
    const drawn = drawCards(next, actor.id, 1, 'forced');
    next = drawn.state;
    events.push(...drawn.events);
    if (playerById(next, actor.id).hand.length === 0) {
      return ok(finish(next, actor.id, events)); // nothing left to draw anywhere: they win after all
    }
    if (phase.kind === 'TakiSequence') {
      events.push({
        type: EngineEventType.TakiClosed,
        playerId: actor.id,
        cardsPlayed: phase.playedCount + 1,
      });
    }
    return ok(applyResolution(next, { kind: 'advance', skip: 0 }, events));
  }

  if (handEmpty) {
    if (phase.kind === 'TakiSequence') {
      events.push({
        type: EngineEventType.TakiClosed,
        playerId: actor.id,
        cardsPlayed: phase.playedCount + 1,
      });
    }
    return ok(finish(next, actor.id, events));
  }

  if (phase.kind === 'TakiSequence') {
    const updated: GamePhase = {
      ...phase,
      playedCount: phase.playedCount + 1,
      lastCardId: card.id,
    };
    next = { ...next, phase: updated };
    events.push({
      type: EngineEventType.PhaseChanged,
      phase: updated,
      currentPlayerId: actor.id,
      direction: next.direction,
    });
    return ok(withVersion(next, events));
  }

  const resolution = handler.resolve(card, {
    playerCount: next.players.length,
    rules: next.rules,
    chosenColor,
  });
  if (chosenColor && card.kind === CardKind.ChangeColor) {
    events.push({
      type: EngineEventType.ColorChosen,
      playerId: actor.id,
      color: chosenColor,
    });
  }
  return ok(applyResolution(next, resolution, events));
}

function drawForTurn(state: GameState, actor: PlayerState): ReduceResult {
  if (state.phase.kind === 'TakiSequence') {
    return err(
      violation(RuleViolationCode.CannotDrawDuringTaki, 'Close the TAKI first'),
    );
  }
  if (state.phase.kind === 'AwaitingColorChoice') {
    return err(
      violation(RuleViolationCode.MustChooseColor, 'Choose a colour first'),
    );
  }
  const drawn = drawCards(state, actor.id, 1, 'turn');
  return ok(
    applyResolution(drawn.state, { kind: 'advance', skip: 0 }, drawn.events),
  );
}

function chooseColor(
  state: GameState,
  actor: PlayerState,
  color: Color,
): ReduceResult {
  if (state.phase.kind !== 'AwaitingColorChoice') {
    return err(
      violation(
        RuleViolationCode.ColorChoiceNotExpected,
        'No colour choice is pending',
      ),
    );
  }
  const events: EngineEvent[] = [
    { type: EngineEventType.ColorChosen, playerId: actor.id, color },
  ];
  return ok(
    applyResolution(
      { ...state, activeColor: color },
      { kind: 'advance', skip: 0 },
      events,
    ),
  );
}

function closeTaki(state: GameState, actor: PlayerState): ReduceResult {
  const phase = state.phase;
  if (phase.kind !== 'TakiSequence') {
    return err(
      violation(RuleViolationCode.NoTakiToClose, 'There is no open TAKI'),
    );
  }
  const events: EngineEvent[] = [
    {
      type: EngineEventType.TakiClosed,
      playerId: actor.id,
      cardsPlayed: phase.playedCount,
    },
  ];
  // The last card played in the sequence decides what happens next; a TAKI closed on the
  // TAKI card itself just passes the turn.
  const lastCard = state.discardPile.find(c => c.id === phase.lastCardId);
  const resolution: TurnResolution =
    !lastCard || lastCard.kind === CardKind.Taki
      ? { kind: 'advance', skip: 0 }
      : handlerFor(lastCard).resolve(lastCard, {
          playerCount: state.players.length,
          rules: state.rules,
        });
  return ok(applyResolution(state, resolution, events));
}

// -------------------------------------------------------------------------------------------
// Turn resolution
// -------------------------------------------------------------------------------------------

function applyResolution(
  state: GameState,
  resolution: TurnResolution,
  events: EngineEvent[],
): EngineResult {
  const actorId = currentPlayerId(state);
  let next = state;
  switch (resolution.kind) {
    case 'advance':
      next = advanceTurn(next, resolution.skip, events);
      break;
    case 'reverse': {
      const direction: Direction = next.direction === 1 ? -1 : 1;
      next = { ...next, direction };
      events.push({ type: EngineEventType.DirectionChanged, direction });
      next = advanceTurn(next, 0, events);
      break;
    }
    case 'samePlayer':
      next = {
        ...next,
        phase: { kind: 'AwaitingPlay', playerId: actorId, afterPlus: true },
      };
      break;
    case 'chooseColor':
      next = {
        ...next,
        phase: { kind: 'AwaitingColorChoice', playerId: actorId },
      };
      break;
    case 'openTaki': {
      const lastCardId = topCard(next).id;
      next = {
        ...next,
        phase: {
          kind: 'TakiSequence',
          playerId: actorId,
          color: resolution.color,
          playedCount: 0,
          lastCardId,
        },
      };
      events.push({
        type: EngineEventType.TakiOpened,
        playerId: actorId,
        color: resolution.color,
      });
      break;
    }
  }
  events.push({
    type: EngineEventType.PhaseChanged,
    phase: next.phase,
    currentPlayerId: currentPlayerId(next),
    direction: next.direction,
  });
  return withVersion(next, events);
}

function advanceTurn(
  state: GameState,
  skip: number,
  events: EngineEvent[],
): GameState {
  const count = state.players.length;
  let seat = state.currentSeat;
  for (let i = 0; i < skip; i++) {
    seat = wrap(seat + state.direction, count);
    events.push({
      type: EngineEventType.PlayerSkipped,
      playerId: state.players[seat].id,
    });
  }
  seat = wrap(seat + state.direction, count);
  const playerId = state.players[seat].id;
  return {
    ...state,
    currentSeat: seat,
    phase: { kind: 'AwaitingPlay', playerId, afterPlus: false },
  };
}

function finish(
  state: GameState,
  winnerId: string,
  events: EngineEvent[],
): EngineResult {
  const others = state.players
    .filter(p => p.id !== winnerId)
    .sort((a, b) => a.hand.length - b.hand.length || a.seat - b.seat)
    .map(p => p.id);
  const finishOrder = [winnerId, ...others];
  const phase: GamePhase = { kind: 'Finished', winnerId, finishOrder };
  events.push({ type: EngineEventType.GameFinished, winnerId, finishOrder });
  events.push({
    type: EngineEventType.PhaseChanged,
    phase,
    currentPlayerId: currentPlayerId(state),
    direction: state.direction,
  });
  return withVersion({ ...state, phase }, events);
}

// -------------------------------------------------------------------------------------------
// Piles
// -------------------------------------------------------------------------------------------

function drawCards(
  state: GameState,
  playerId: string,
  count: number,
  reason: DrawReason,
): EngineResult {
  const events: EngineEvent[] = [];
  let next = state;
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (next.drawPile.length === 0) {
      const reshuffled = reshuffleDiscards(next);
      if (!reshuffled) break; // every card is in someone's hand: nothing to draw
      next = reshuffled;
      events.push({
        type: EngineEventType.DeckReshuffled,
        drawPileCount: next.drawPile.length,
      });
    }
    const [card, ...rest] = next.drawPile;
    drawn.push(card);
    next = { ...next, drawPile: rest };
  }
  const player = playerById(next, playerId);
  next = {
    ...next,
    players: replacePlayer(next.players, {
      ...player,
      hand: [...player.hand, ...drawn],
    }),
  };
  events.push({
    type: EngineEventType.CardsDrawn,
    playerId,
    cards: drawn,
    reason,
  });
  return { state: next, events };
}

/** Turns the discard pile (minus its top card) into a fresh draw pile. Null when nothing to reshuffle. */
function reshuffleDiscards(state: GameState): GameState | null {
  if (state.discardPile.length <= 1) return null;
  const top = topCard(state);
  const rest = state.discardPile.slice(0, -1);
  const shuffled = shuffle(rest, state.rng);
  return {
    ...state,
    drawPile: shuffled.items,
    discardPile: [top],
    rng: shuffled.next,
  };
}

// -------------------------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------------------------

function withVersion(state: GameState, events: EngineEvent[]): EngineResult {
  return {
    state: { ...state, version: state.version + events.length },
    events,
  };
}

function replacePlayer(
  players: PlayerState[],
  updated: PlayerState,
): PlayerState[] {
  return players.map(p => (p.id === updated.id ? updated : p));
}

function playerById(state: GameState, playerId: string): PlayerState {
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error(`Unknown player ${playerId}`);
  return player;
}

function wrap(seat: number, count: number): number {
  return ((seat % count) + count) % count;
}
