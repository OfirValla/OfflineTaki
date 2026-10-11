import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../app/theme';
import { REACTION_EMOJIS, type ReactionEmoji } from '../../networking/protocol';

interface ReactionTrayProps {
  visible: boolean;
  onPick: (emoji: ReactionEmoji) => void;
  onClose: () => void;
}

/** Bottom sheet with the quick reactions. One tap sends and closes. */
export function ReactionTray({ visible, onPick, onClose }: ReactionTrayProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close reactions"
      >
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Send a reaction</Text>
          <View style={styles.grid}>
            {REACTION_EMOJIS.map(emoji => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`Send ${emoji}`}
                onPress={() => onPick(emoji)}
                style={({ pressed }) => [
                  styles.cell,
                  pressed && styles.cellPressed,
                ]}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceSolid,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  title: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cell: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellPressed: { backgroundColor: colors.accent },
  emoji: { fontSize: 32, lineHeight: 38 },
});
