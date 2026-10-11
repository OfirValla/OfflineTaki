import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';
import { ALL_COLORS, type Color } from '../../game';
import { CARD_COLORS } from '../cards/CardView';

interface ColorPickerProps {
  visible: boolean;
  title: string;
  onPick: (color: Color) => void;
  /** Absent when the choice cannot be cancelled (the engine is waiting for it). */
  onCancel?: () => void;
}

export function ColorPicker({
  visible,
  title,
  onPick,
  onCancel,
}: ColorPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        disabled={!onCancel}
      >
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.grid}>
            {ALL_COLORS.map(color => (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityLabel={color}
                onPress={() => onPick(color)}
                style={({ pressed }) => [
                  styles.swatch,
                  { backgroundColor: CARD_COLORS[color] },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.swatchLabel}>{color}</Text>
              </Pressable>
            ))}
          </View>
          {onCancel ? (
            <Pressable
              onPress={onCancel}
              style={styles.cancel}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.heading, color: colors.text, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  swatch: {
    width: '45%',
    aspectRatio: 1.4,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  swatchLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    textTransform: 'capitalize',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  cancel: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cancelText: { color: colors.textMuted, fontWeight: '700' },
});
