import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../app/theme';
import { LobbyPhase, PlayerKind, type PeerInfo } from '../networking/protocol';
import type { SessionPeer } from '../networking/session/SessionState';

interface PeerListProps {
  self: PeerInfo;
  peers: SessionPeer[];
  seatCount: number;
  phase: LobbyPhase;
  showVerificationCodes?: boolean;
}

type Row =
  | { kind: 'player'; peer: SessionPeer; isSelf: boolean }
  | { kind: 'open'; index: number };

export function PeerList({
  self,
  peers,
  seatCount,
  phase,
  showVerificationCodes = false,
}: PeerListProps) {
  const players: Row[] = [
    { kind: 'player', peer: self, isSelf: true },
    ...peers.map(peer => ({ kind: 'player' as const, peer, isSelf: false })),
  ];
  const openSeats =
    phase === LobbyPhase.Lobby ? Math.max(0, seatCount - players.length) : 0;
  const rows: Row[] = [
    ...players,
    ...Array.from({ length: openSeats }, (_, index) => ({
      kind: 'open' as const,
      index,
    })),
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        Players {players.length}/{seatCount}
      </Text>
      {rows.map(row =>
        row.kind === 'open' ? (
          <View key={`open-${row.index}`} style={styles.row}>
            <View style={[styles.dot, styles.dotOpen]} />
            <Text style={styles.openSeat}>
              Open seat · becomes a bot at start
            </Text>
          </View>
        ) : (
          <View key={row.peer.playerId} style={styles.row}>
            <View
              style={[
                styles.dot,
                row.isSelf
                  ? styles.dotSelf
                  : row.peer.kind === PlayerKind.Bot
                  ? styles.dotBot
                  : row.peer.connected
                  ? styles.dotPeer
                  : styles.dotOffline,
              ]}
            />
            <Text
              style={[styles.name, !row.peer.connected && styles.nameOffline]}
              numberOfLines={1}
            >
              {row.peer.name}
              {row.isSelf ? ' (you)' : ''}
              {!row.peer.connected ? ' · reconnecting…' : ''}
            </Text>
            {row.peer.isHost ? <Text style={styles.badge}>HOST</Text> : null}
            {row.peer.kind === PlayerKind.Bot ? (
              <Text style={[styles.badge, styles.badgeBot]}>BOT</Text>
            ) : null}
            {showVerificationCodes && row.peer.verificationCode ? (
              <Text style={styles.code}>{row.peer.verificationCode}</Text>
            ) : null}
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  heading: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 24,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotSelf: { backgroundColor: colors.accent },
  dotPeer: { backgroundColor: colors.success },
  dotBot: { backgroundColor: colors.info },
  dotOffline: { backgroundColor: colors.danger },
  dotOpen: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  name: { flex: 1, color: colors.text, fontSize: 16 },
  nameOffline: { color: colors.textMuted },
  openSeat: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  badge: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeBot: { color: colors.info, borderColor: colors.info },
  code: { ...typography.mono, color: colors.textMuted },
});
