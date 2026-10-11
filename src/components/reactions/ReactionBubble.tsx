import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { REACTION_DISPLAY_MS } from '../../networking/protocol';
import type { Reaction } from '../../networking/session/SessionState';

interface ReactionBubbleProps {
  reaction: Reaction;
  /** Where the little tail points: a seat above the bubble, or your hand below it. */
  tail?: 'down' | 'up';
  style?: ViewStyle;
}

/** A speech bubble with one emoji that pops in and fades away. Remounts per reaction via its key. */
export function ReactionBubble({
  reaction,
  tail = 'down',
  style,
}: ReactionBubbleProps) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const remaining = Math.max(
      400,
      reaction.at + REACTION_DISPLAY_MS - Date.now(),
    );
    const show = Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 160,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]);
    const hide = Animated.timing(opacity, {
      toValue: 0,
      duration: 350,
      delay: Math.max(0, remaining - 350),
      useNativeDriver: true,
    });
    const sequence = Animated.sequence([show, hide]);
    sequence.start();
    return () => sequence.stop();
  }, [reaction.id, reaction.at, scale, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, style, { opacity, transform: [{ scale }] }]}
    >
      {tail === 'up' ? <View style={[styles.tail, styles.tailUp]} /> : null}
      <View style={styles.bubble}>
        <Text style={styles.emoji}>{reaction.emoji}</Text>
      </View>
      {tail === 'down' ? <View style={[styles.tail, styles.tailDown]} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  emoji: { fontSize: 28, lineHeight: 34 },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tailDown: { borderTopWidth: 8, borderTopColor: '#FFFFFF' },
  tailUp: { borderBottomWidth: 8, borderBottomColor: '#FFFFFF' },
});
