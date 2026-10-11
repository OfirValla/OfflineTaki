import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenProps } from '../../app/navigation';
import { useSessionApi } from '../../app/SessionContext';
import { colors, radius, spacing, typography } from '../../app/theme';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { useDiscoveredGames } from '../../hooks/useDiscoveredGames';
import type { DiscoveredGame } from '../../networking/transport/types';

export function JoinGameScreen({ navigation }: ScreenProps<'Join'>) {
  const { transport, joinGame } = useSessionApi();
  const [paused, setPaused] = useState(false);
  const { games, error: discoveryError } = useDiscoveredGames(
    transport,
    !paused,
  );
  const [connectingTo, setConnectingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (discoveryError) setError(discoveryError);
  }, [discoveryError]);

  const onSelect = async (game: DiscoveredGame) => {
    setError(null);
    setConnectingTo(game.peerId);
    setPaused(true); // stop scanning while we connect; scanning competes with the link
    try {
      await joinGame(game);
      navigation.replace('Session');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPaused(false);
    } finally {
      setConnectingTo(null);
    }
  };

  return (
    <Screen>
      <Text style={styles.heading}>Nearby games</Text>
      <Text style={styles.sub}>
        Bluetooth range is about a few rows of seats. The host must be on their
        game screen.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={games}
        keyExtractor={g => g.peerId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.emptyText}>Looking for games…</Text>
          </View>
        }
        renderItem={({ item }) => {
          const busy = connectingTo === item.peerId;
          const full = item.playerCount >= item.maxPlayers;
          return (
            <Pressable
              onPress={() => void onSelect(item)}
              disabled={connectingTo !== null || full}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
                full && styles.cardDisabled,
              ]}
            >
              <View style={styles.cardText}>
                <Text style={styles.gameName}>{item.gameName}</Text>
                <Text style={styles.meta}>
                  Host: {item.hostName} · {item.playerCount}/{item.maxPlayers}{' '}
                  players
                  {item.requiresJoinCode ? ' · code required' : ''}
                </Text>
              </View>
              {busy ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={styles.joinLabel}>{full ? 'FULL' : 'JOIN'}</Text>
              )}
            </Pressable>
          );
        }}
      />

      <PrimaryButton
        title="Back"
        variant="secondary"
        onPress={() => navigation.goBack()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.heading, color: colors.text },
  sub: {
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  error: { color: colors.danger, marginBottom: spacing.sm },
  list: { gap: spacing.sm, flexGrow: 1 },
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl * 2 },
  emptyText: { color: colors.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.surfaceRaised },
  cardDisabled: { opacity: 0.5 },
  cardText: { flex: 1, gap: spacing.xs },
  gameName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  joinLabel: { color: colors.accent, fontWeight: '800', letterSpacing: 1 },
});
