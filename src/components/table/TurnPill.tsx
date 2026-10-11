import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../app/theme';

export type PillTone = 'accent' | 'muted' | 'danger';

/** The one-line status above the table: whose turn, TAKI mode, connection trouble. */
export function TurnPill({ text, tone }: { text: string; tone: PillTone }) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'accent' && styles.accent,
        tone === 'danger' && styles.danger,
      ]}
    >
      <Text
        style={[styles.text, tone === 'accent' && styles.textAccent]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  accent: { backgroundColor: colors.accent, borderColor: '#FFE08A' },
  danger: { backgroundColor: colors.danger, borderColor: '#FF9A9D' },
  text: {
    color: colors.text,
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 14,
  },
  textAccent: { color: colors.accentText },
});
