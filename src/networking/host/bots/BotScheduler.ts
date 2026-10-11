import type { GameAction, LegalMoves, PlayerView } from '../../../game';
import type { BotStrategy } from './BotStrategy';

export interface ScheduledTurn {
  botId: string;
  view: PlayerView;
  moves: LegalMoves;
}

export interface BotSchedulerOptions {
  strategy: BotStrategy;
  /** Thinking time before a bot acts; randomised so turns feel natural. */
  delayMs: () => number;
  /** Called on the host to apply the action; return false if the turn is no longer valid. */
  act: (botId: string, action: GameAction) => void;
}

/**
 * Runs at most one pending bot turn. The host calls `consider` after every state change; a
 * newer state cancels whatever was queued, so a bot never acts on stale information.
 */
export class BotScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private idleWaiters: Array<() => void> = [];

  constructor(private readonly options: BotSchedulerOptions) {}

  consider(turn: ScheduledTurn | null): void {
    this.cancel();
    if (!turn) {
      this.notifyIdle();
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      const action = this.options.strategy.chooseAction(turn.view, turn.moves);
      this.options.act(turn.botId, action);
      // `act` normally calls `consider` again; if not, we are idle.
      if (this.timer === null) this.notifyIdle();
    }, this.options.delayMs());
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  get pending(): boolean {
    return this.timer !== null;
  }

  /** Resolves once no bot turn is queued. Test helper. */
  settle(): Promise<void> {
    if (this.timer === null) return Promise.resolve();
    return new Promise(resolve => this.idleWaiters.push(resolve));
  }

  private notifyIdle(): void {
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    for (const resolve of waiters) resolve();
  }
}
