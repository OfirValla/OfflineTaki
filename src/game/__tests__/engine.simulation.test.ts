import { ALL_COLORS } from '../cards/Card';
import { createGame, legalMoves, reduce } from '../engine/GameEngine';
import { createRng, nextInt, type RngState } from '../engine/rng';
import {
  chooseColor,
  closeTaki,
  drawCard,
  playCard,
  type GameAction,
} from '../state/GameAction';
import { currentPlayerId, type GameState } from '../state/GameState';

/**
 * Plays complete games with a random-but-legal player and checks invariants after every move.
 * Anything that can strand the state machine, lose a card or loop forever shows up here.
 */

const MAX_STEPS = 4000;

function pickAction(
  state: GameState,
  rng: RngState,
): { action: GameAction; next: RngState } {
  const playerId = currentPlayerId(state);
  const moves = legalMoves(state, playerId);
  if (moves.mustChooseColor) {
    const draw = nextInt(rng, ALL_COLORS.length);
    return { action: chooseColor(ALL_COLORS[draw.value]), next: draw.next };
  }
  const options: GameAction[] = [];
  for (const id of moves.playableCardIds) {
    const draw = nextInt(rng, ALL_COLORS.length);
    rng = draw.next;
    options.push(playCard(id, ALL_COLORS[draw.value]));
  }
  if (moves.canDraw) options.push(drawCard());
  if (moves.canCloseTaki) options.push(closeTaki());
  expect(options.length).toBeGreaterThan(0);
  const draw = nextInt(rng, options.length);
  return { action: options[draw.value], next: draw.next };
}

function countCards(state: GameState): number {
  return (
    state.players.reduce((n, p) => n + p.hand.length, 0) +
    state.drawPile.length +
    state.discardPile.length
  );
}

function assertInvariants(state: GameState, previousVersion: number): void {
  expect(countCards(state)).toBe(100);
  expect(state.discardPile.length).toBeGreaterThan(0);
  expect(state.version).toBeGreaterThan(previousVersion);
  if (state.phase.kind !== 'Finished') {
    expect(state.phase.playerId).toBe(currentPlayerId(state));
    for (const p of state.players) expect(p.hand.length).toBeGreaterThan(0);
  }
  const ids = [
    ...state.players.flatMap(p => p.hand),
    ...state.drawPile,
    ...state.discardPile,
  ].map(c => c.id);
  expect(new Set(ids).size).toBe(100);
}

describe('random full games', () => {
  const scenarios = [2, 3, 4, 6, 8].flatMap(playerCount =>
    Array.from({ length: 12 }, (_, i) => ({
      playerCount,
      seed: playerCount * 1000 + i,
    })),
  );

  it.each(scenarios)(
    'finishes cleanly with $playerCount players (seed $seed)',
    ({ playerCount, seed }) => {
      const players = Array.from({ length: playerCount }, (_, i) => ({
        id: `p${i + 1}`,
        name: `P${i + 1}`,
      }));
      let { state } = createGame({ gameId: 'sim', players, seed });
      let rng = createRng(seed + 7919); // decouple move choices from the deal
      let steps = 0;
      let winnerSeenViaEvent = false;

      while (state.phase.kind !== 'Finished') {
        const picked = pickAction(state, rng);
        rng = picked.next;
        const before = state.version;
        const result = reduce(state, currentPlayerId(state), picked.action);
        if (!result.ok)
          throw new Error(
            `Legal move rejected: ${result.error.code} ${result.error.message}`,
          );
        state = result.value.state;
        if (result.value.events.some(e => e.type === 'GAME_FINISHED'))
          winnerSeenViaEvent = true;
        assertInvariants(state, before);
        steps++;
        if (steps > MAX_STEPS)
          throw new Error(`Game did not finish within ${MAX_STEPS} moves`);
      }

      expect(winnerSeenViaEvent).toBe(true);
      const winner = state.players.find(
        p => p.id === (state.phase as { winnerId: string }).winnerId,
      );
      expect(winner?.hand).toHaveLength(0);
      expect(
        (state.phase as { finishOrder: string[] }).finishOrder,
      ).toHaveLength(playerCount);
    },
  );
});
