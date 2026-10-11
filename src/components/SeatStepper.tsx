import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../app/theme';

interface SeatStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  hint?: string;
  disabled?: boolean;
}

/** A − / + control for whole numbers, sized for thumbs. */
export function SeatStepper({
  label,
  value,
  min,
  max,
  onChange,
  hint,
  disabled,
}: SeatStepperProps) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;
  return (
    <View style={styles.container}>
      <View style={styles.textColumn}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.controls}>
        <StepButton
          symbol="−"
          enabled={canDecrease}
          onPress={() => onChange(value - 1)}
        />
        <Text style={styles.value} accessibilityLabel={`${label}: ${value}`}>
          {value}
        </Text>
        <StepButton
          symbol="+"
          enabled={canIncrease}
          onPress={() => onChange(value + 1)}
        />
      </View>
    </View>
  );
}

function StepButton({
  symbol,
  enabled,
  onPress,
}: {
  symbol: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        !enabled && styles.buttonDisabled,
        pressed && enabled && styles.buttonPressed,
      ]}
    >
      <Text style={styles.buttonLabel}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textColumn: { flex: 1, gap: 2 },
  label: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  value: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    minWidth: 32,
    textAlign: 'center',
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPressed: { backgroundColor: colors.border },
  buttonDisabled: { opacity: 0.35 },
  buttonLabel: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
});
