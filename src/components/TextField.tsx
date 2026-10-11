import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, radius, spacing, typography } from '../app/theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
}

export function TextField({ label, style, ...inputProps }: TextFieldProps) {
  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        style={[styles.input, style]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 17,
  },
});
