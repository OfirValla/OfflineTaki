import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';
import type { PlayerView } from '../../game';
import { PrimaryButton } from '../PrimaryButton';

interface GameOverPanelProps {
  view: PlayerView;
  isHost: boolean;
  onNewRound: () => void;
  onLeave: () => void;
  busy?: boolean;
}

export function GameOverPanel({
  view,
  isHost,
  onNewRound,
  onLeave,
  busy,
}: GameOverPanelProps) {
  if (view.phase.kind !== 'Finished') return null;
  const { winnerId, finishOrder } = view.phase;
  const nameOf = (id: string) =>
    view.players.find(p => p.id === id)?.name ?? id;
  const youWon = winnerId === view.you.playerId;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>
        {youWon ? 'You won!' : `${nameOf(winnerId)} wins`}
      </Text>
      <View style={styles.table}>
        {finishOrder.map((id, index) => {
          const player = view.players.find(p => p.id === id);
          return (
            <View key={id} style={styles.row}>
              <Text style={styles.rank}>{index + 1}.</Text>
              <Text
                style={[
                  styles.name,
                  id === view.you.playerId && styles.nameYou,
                ]}
                numberOfLines={1}
              >
                {player?.name ?? id}
              </Text>
              <Text style={styles.cards}>
                {index === 0 ? 'out' : `${player?.cardCount ?? '?'} left`}
              </Text>
            </View>
          );
        })}
      </View>
      {isHost ? (
        <PrimaryButton title="New round" onPress={onNewRound} loading={busy} />
      ) : (
        <Text style={styles.waiting}>
          Waiting for the host to start a new round…
        </Text>
      )}
      <PrimaryButton title="Leave game" variant="secondary" onPress={onLeave} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.heading,
    color: colors.accent,
    textAlign: 'center',
    fontSize: 26,
  },
  table: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: { color: colors.textMuted, width: 24, fontWeight: '700' },
  name: { flex: 1, color: colors.text, fontSize: 16 },
  nameYou: { color: colors.accent, fontWeight: '700' },
  cards: { color: colors.textMuted },
  waiting: { color: colors.textMuted, textAlign: 'center' },
});
