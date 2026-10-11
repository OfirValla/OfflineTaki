import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors, spacing } from '../../app/theme';
import { describeCard, type Card } from '../../game';
import { CARD_SIZES, CardView } from './CardView';

interface HandFanProps {
  hand: Card[];
  playableIds: string[];
  /** When false every card is muted and untouchable (not your turn / action pending). */
  interactive: boolean;
  onPlay: (card: Card) => void;
}

const OVERLAP = 38;
const MAX_TILT = 14;
const LIFT = 18;

/** Your cards, fanned and overlapping, scrolling sideways when there are many. */
export function HandFan({
  hand,
  playableIds,
  interactive,
  onPlay,
}: HandFanProps) {
  const { width: screenWidth } = useWindowDimensions();
  const dims = CARD_SIZES.hand;

  if (hand.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No cards</Text>
      </View>
    );
  }

  const n = hand.length;
  const mid = (n - 1) / 2;
  const contentWidth =
    dims.width + (n - 1) * (dims.width - OVERLAP) + spacing.md * 2;
  const centered = contentWidth <= screenWidth;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.content,
        centered && styles.contentCentered,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {hand.map((card, i) => {
        const playable = interactive && playableIds.includes(card.id);
        const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, (i - mid) * 3));
        const droop = Math.abs(i - mid) * 1.6;
        return (
          <View
            key={card.id}
            style={[
              styles.slot,
              { marginLeft: -OVERLAP * Math.min(i, 1), zIndex: i },
              {
                transform: [
                  { translateY: droop - (playable ? LIFT : 0) },
                  { rotate: `${tilt}deg` },
                ],
              },
            ]}
          >
            <CardView
              card={card}
              size="hand"
              highlighted={playable}
              dimmed={!playable}
              disabled={!playable}
              onPress={() => onPlay(card)}
              accessibilityLabel={`${describeCard(card)}${
                playable ? ', playable' : ''
              }`}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: LIFT + 8,
    paddingBottom: spacing.md,
    alignItems: 'flex-end',
  },
  contentCentered: { flexGrow: 1, justifyContent: 'center' },
  slot: {},
  empty: { height: 150, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted },
});
