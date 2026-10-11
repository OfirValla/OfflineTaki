/** The quick reactions a player can send mid-game. A fixed list so the wire format stays tiny and validated. */
export const REACTION_EMOJIS = [
  '😀',
  '😂',
  '😮',
  '😡',
  '😭',
  '🤔',
  '😎',
  '👏',
  '👍',
  '🔥',
  '🎉',
  '😅',
] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(value);
}

/** Minimum gap between two reactions from the same player; the host drops anything faster. */
export const REACTION_MIN_INTERVAL_MS = 700;

/** How long a reaction bubble stays on screen. */
export const REACTION_DISPLAY_MS = 3000;
