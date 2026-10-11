import {
  createGame,
  currentPlayerId,
  legalMoves,
  projectForPlayer,
  redactEvent,
  reduce,
} from '../../game';
import { applyClientEvent } from '../client/applyClientEvent';
import { firstLegalAction } from '../testing/harness';

/** Feeding every redacted event into a view must reproduce the host projection exactly. */
describe('applyClientEvent', () => {
  it.each([1, 2, 3, 4, 5])(
    'tracks the host projection through a full game (seed %i)',
    seed => {
      const players = [
        { id: 'p1', name: 'A' },
        { id: 'p2', name: 'B' },
        { id: 'p3', name: 'C' },
      ];
      let { state } = createGame({ gameId: 'g', players, seed });
      const views = new Map(
        players.map(p => [p.id, projectForPlayer(state, p.id)]),
      );

      let steps = 0;
      while (state.phase.kind !== 'Finished' && steps++ < 3000) {
        const playerId = currentPlayerId(state);
        const view = views.get(playerId)!;
        const action = firstLegalAction(view, legalMoves(state, playerId));
        if (!action) throw new Error('no action');
        const result = reduce(state, playerId, action);
        if (!result.ok) throw new Error(result.error.message);
        let version = state.version;
        state = result.value.state;
        for (const event of result.value.events) {
          version++;
          for (const p of players) {
            views.set(
              p.id,
              applyClientEvent(
                views.get(p.id)!,
                redactEvent(event, p.id),
                version,
              ),
            );
          }
        }
        for (const p of players) {
          expect(views.get(p.id)).toEqual(projectForPlayer(state, p.id));
        }
      }
      expect(state.phase.kind).toBe('Finished');
    },
  );
});
