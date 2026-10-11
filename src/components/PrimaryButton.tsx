import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '../app/theme';

type Variant = 'primary' | 'secondary' | 'danger';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: PrimaryButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.accentText : colors.text}
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' ? styles.labelOnAccent : styles.labelOnDark,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  label: { fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  labelOnAccent: { color: colors.accentText },
  labelOnDark: { color: colors.text },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.accent },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: { backgroundColor: colors.danger },
};
