import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../app/theme';

/** Round speaker button that mutes or unmutes the sound effects. */
export function SoundToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onToggle(!enabled)}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel={enabled ? 'Sound on' : 'Sound off'}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        !enabled && styles.muted,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.icon}>{enabled ? '🔊' : '🔇'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  muted: { opacity: 0.6 },
  pressed: { opacity: 0.8 },
  icon: { fontSize: 20 },
});
