import React, { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../app/theme';
import type { ChatEntry } from '../networking/session/SessionState';

interface MessageLogProps {
  messages: ChatEntry[];
  selfId: string;
}

export function MessageLog({ messages, selfId }: MessageLogProps) {
  const listRef = useRef<FlatList<ChatEntry>>(null);

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(
        () => listRef.current?.scrollToEnd({ animated: true }),
        50,
      );
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => {
        if (item.kind === 'system') {
          return <Text style={styles.system}>{item.text}</Text>;
        }
        const mine = item.fromId === selfId;
        return (
          <View
            style={[
              styles.bubble,
              mine ? styles.bubbleMine : styles.bubbleTheirs,
            ]}
          >
            {!mine ? <Text style={styles.sender}>{item.fromName}</Text> : null}
            <Text style={[styles.text, mine && styles.textMine]}>
              {item.text}
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingVertical: spacing.sm },
  system: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceRaised,
  },
  sender: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  text: { color: colors.text, fontSize: 16 },
  textMine: { color: colors.accentText },
});
