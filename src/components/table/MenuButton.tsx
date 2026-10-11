import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

/** The green pause pill at the top-left of the table. */
export function MenuButton({
  onPress,
  label = '❚❚',
}: {
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Game menu"
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5FC53B',
    borderWidth: 2,
    borderColor: '#9BE27E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pressed: { opacity: 0.85 },
  label: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
});
