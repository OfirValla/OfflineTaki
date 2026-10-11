/**
 * Deterministic pseudo-random numbers (mulberry32). The state is a plain value carried inside
 * GameState, so the same seed always produces the same shuffle: games are replayable and tests
 * are exact.
 */

export interface RngState {
  readonly seed: number;
}

export function createRng(seed: number): RngState {
  // eslint-disable-next-line no-bitwise -- force an unsigned 32-bit seed
  return { seed: seed >>> 0 };
}

/** Returns a number in [0, 1) and the advanced state. */
export function nextRandom(state: RngState): { value: number; next: RngState } {
  /* eslint-disable no-bitwise -- mulberry32 is defined on 32-bit integer arithmetic */
  const seed = (state.seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  /* eslint-enable no-bitwise */
  return { value, next: { seed } };
}

/** Integer in [0, maxExclusive). */
export function nextInt(
  state: RngState,
  maxExclusive: number,
): { value: number; next: RngState } {
  const { value, next } = nextRandom(state);
  return { value: Math.floor(value * maxExclusive), next };
}

/** Fisher–Yates shuffle that returns a new array and the advanced state. */
export function shuffle<T>(
  items: readonly T[],
  state: RngState,
): { items: T[]; next: RngState } {
  const result = items.slice();
  let rng = state;
  for (let i = result.length - 1; i > 0; i--) {
    const draw = nextInt(rng, i + 1);
    rng = draw.next;
    const j = draw.value;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return { items: result, next: rng };
}
