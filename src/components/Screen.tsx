import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../app/theme';
import { TableBackground } from './table/TableBackground';

interface ScreenProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Wraps content so the keyboard does not cover inputs at the bottom. */
  avoidKeyboard?: boolean;
}

/** Safe-area padded page over the blue table background. */
export function Screen({
  children,
  style,
  avoidKeyboard = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + spacing.md,
    paddingBottom: insets.bottom + spacing.md,
    paddingLeft: insets.left + spacing.md,
    paddingRight: insets.right + spacing.md,
  };
  const content = (
    <View style={styles.root}>
      <TableBackground showFelt={false} />
      <View style={[styles.content, padding, style]}>{children}</View>
    </View>
  );
  if (!avoidKeyboard) return content;
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
});
