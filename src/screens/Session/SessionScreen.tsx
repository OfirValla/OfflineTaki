import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ScreenProps } from '../../app/navigation';
import { useSessionApi } from '../../app/SessionContext';
import { colors, radius, spacing, typography } from '../../app/theme';
import { MessageLog } from '../../components/MessageLog';
import { PeerList } from '../../components/PeerList';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { SeatStepper } from '../../components/SeatStepper';
import { useSessionState } from '../../hooks/useSessionState';
import { GameHost } from '../../networking/host/GameHost';
import { LobbyPhase, MAX_SEATS, MIN_SEATS } from '../../networking/protocol';
import type { SessionStatus } from '../../networking/session/SessionState';

const STATUS_LABEL: Record<SessionStatus, string> = {
  idle: 'Starting…',
  hosting: 'Visible to nearby phones',
  connecting: 'Connecting…',
  joining: 'Joining…',
  joined: 'Connected',
  rejected: 'Could not join',
  disconnected: 'Disconnected',
  closed: 'Left',
};

/** The lobby: who is here, how many seats, chat, and the host's Start button. */
export function SessionScreen({ navigation }: ScreenProps<'Session'>) {
  const { session, leave } = useSessionApi();
  const state = useSessionState(session);
  const [draft, setDraft] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!session) navigation.replace('Home');
  }, [session, navigation]);

  // The moment cards are dealt, everyone moves to the table.
  useEffect(() => {
    if (state?.phase === LobbyPhase.Started && state.game)
      navigation.replace('Game');
  }, [state?.phase, state?.game, navigation]);

  if (!session || !state) return <Screen />;

  const host = session instanceof GameHost ? session : null;
  const isHost = host !== null;
  const humans = session.humanCount();
  const openSeats = session.openSeats();
  const canChat = isHost
    ? state.peers.some(p => p.peerId)
    : state.status === 'joined';
  const problem =
    state.status === 'rejected' || state.status === 'disconnected';

  const statusText = isHost
    ? `Hosting · ${STATUS_LABEL[state.status]}`
    : state.status === 'joined'
    ? 'Waiting for the host to start'
    : STATUS_LABEL[state.status];

  const onSend = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void session.sendChat(text);
  };

  const onStart = () => {
    if (!host) return;
    const begin = async () => {
      setStarting(true);
      try {
        await host.startGame();
      } finally {
        setStarting(false);
      }
    };
    if (openSeats === 0) {
      void begin();
      return;
    }
    Alert.alert(
      'Start with bots?',
      `${openSeats} open seat${
        openSeats === 1 ? '' : 's'
      } will be filled with bots. Nobody else can join afterwards.`,
      [
        { text: 'Wait', style: 'cancel' },
        { text: 'Start', onPress: () => void begin() },
      ],
    );
  };

  const onLeave = async () => {
    setLeaving(true);
    await leave();
    navigation.replace('Home');
  };

  return (
    <Screen avoidKeyboard>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.gameName} numberOfLines={1}>
            {state.gameName || 'Game'}
          </Text>
          <Text style={[styles.status, problem && styles.statusProblem]}>
            {statusText}
          </Text>
        </View>
        <Text style={styles.roleBadge}>{isHost ? 'HOST' : 'PLAYER'}</Text>
      </View>

      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}

      <PeerList
        self={state.self}
        peers={state.peers}
        seatCount={state.seatCount}
        phase={state.phase}
        showVerificationCodes={isHost}
      />

      {host ? (
        <View style={styles.hostControls}>
          <SeatStepper
            label="Players"
            value={state.seatCount}
            min={Math.max(MIN_SEATS, humans)}
            max={MAX_SEATS}
            onChange={value => void host.setSeatCount(value)}
          />
          <PrimaryButton
            title={
              openSeats > 0
                ? `Start with ${openSeats} bot${openSeats === 1 ? '' : 's'}`
                : 'Start game'
            }
            onPress={onStart}
            loading={starting}
          />
        </View>
      ) : null}

      <View style={styles.log}>
        <MessageLog messages={state.messages} selfId={state.self.playerId} />
      </View>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={
            canChat
              ? `Hello from ${state.self.name}`
              : 'Waiting for a connection…'
          }
          placeholderTextColor={colors.textMuted}
          editable={canChat}
          returnKeyType="send"
          onSubmitEditing={onSend}
          blurOnSubmit={false}
        />
        <PrimaryButton
          title="Send"
          onPress={onSend}
          disabled={!canChat || draft.trim().length === 0}
          style={styles.send}
        />
      </View>

      <PrimaryButton
        title={isHost ? 'Stop hosting' : 'Leave'}
        variant="danger"
        onPress={() => void onLeave()}
        loading={leaving}
        style={styles.leave}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1 },
  gameName: { ...typography.heading, color: colors.text },
  status: { color: colors.textMuted, marginTop: 2 },
  statusProblem: { color: colors.danger },
  roleBadge: {
    color: colors.accent,
    fontWeight: '800',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  error: { color: colors.danger, marginBottom: spacing.sm },
  hostControls: { gap: spacing.sm, marginTop: spacing.sm },
  log: { flex: 1, marginTop: spacing.sm },
  composer: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  input: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  send: { minHeight: 52, paddingHorizontal: spacing.md },
  leave: { marginTop: spacing.sm },
});
