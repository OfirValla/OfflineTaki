import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScreenProps } from '../../app/navigation';
import { useSessionApi } from '../../app/SessionContext';
import { colors, spacing } from '../../app/theme';
import { HandFan } from '../../components/cards/HandFan';
import { ColorPicker } from '../../components/game/ColorPicker';
import { GameOverPanel } from '../../components/game/GameOverPanel';
import { PrimaryButton } from '../../components/PrimaryButton';
import { CenterPile } from '../../components/table/CenterPile';
import { MenuButton } from '../../components/table/MenuButton';
import { OpponentSeats } from '../../components/table/OpponentSeats';
import { TableBackground } from '../../components/table/TableBackground';
import { TurnPill, type PillTone } from '../../components/table/TurnPill';
import { useSessionState } from '../../hooks/useSessionState';
import {
  CardKind,
  chooseColor,
  closeTaki,
  drawCard,
  playCard,
  type Card,
  type Color,
} from '../../game';
import { GameHost } from '../../networking/host/GameHost';

export function GameScreen({ navigation }: ScreenProps<'Game'>) {
  const { session, leave } = useSessionApi();
  const state = useSessionState(session);
  const view = state?.game ?? null;
  // Cheap to recompute; derived directly so it can never lag behind the view.
  const moves = session && view ? session.legalMoves() : null;
  const [pendingWild, setPendingWild] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!session) navigation.replace('Home');
  }, [session, navigation]);

  const seatsHeight = Math.min(230, Math.max(150, height * 0.27));
  const feltCenterY = insets.top + 56 + seatsHeight + 90;

  if (!session || !state || !view || !moves) {
    return (
      <View style={styles.root}>
        <TableBackground feltCenterY={feltCenterY} />
        <Text style={[styles.waiting, { marginTop: insets.top + spacing.xl }]}>
          Waiting for the deal…
        </Text>
      </View>
    );
  }

  const isHost = session instanceof GameHost;
  const finished = view.phase.kind === 'Finished';
  const connectionLost = state.status === 'disconnected';
  const interactive =
    moves.isYourTurn &&
    state.pendingActionId === null &&
    !connectionLost &&
    !finished;
  const currentName =
    view.players.find(p => p.id === view.currentPlayerId)?.name ?? '…';

  const pill: { text: string; tone: PillTone } = (() => {
    if (connectionLost)
      return { text: 'Connection lost · reconnecting', tone: 'danger' };
    if (finished) return { text: 'Game over', tone: 'muted' };
    if (!moves.isYourTurn)
      return { text: `${currentName}'s turn`, tone: 'muted' };
    if (moves.mustChooseColor)
      return { text: 'Choose a color', tone: 'accent' };
    if (view.phase.kind === 'TakiSequence')
      return {
        text: `TAKI · play ${view.phase.color} or close`,
        tone: 'accent',
      };
    if (view.phase.kind === 'AwaitingPlay' && view.phase.afterPlus)
      return { text: 'YOUR TURN · play again', tone: 'accent' };
    return { text: 'YOUR TURN', tone: 'accent' };
  })();

  const act = (action: Parameters<typeof session.act>[0]) => {
    session.act(action).catch(error => {
      Alert.alert(
        'Could not send move',
        error instanceof Error ? error.message : String(error),
      );
    });
  };

  const onPlay = (card: Card) => {
    if (!interactive) return;
    if (card.kind === CardKind.ChangeColor) {
      setPendingWild(card);
      return;
    }
    act(playCard(card.id));
  };

  const onPickColor = (color: Color) => {
    if (pendingWild) {
      act(playCard(pendingWild.id, color));
      setPendingWild(null);
    } else if (moves.mustChooseColor) {
      act(chooseColor(color));
    }
  };

  const onNewRound = async () => {
    if (!(session instanceof GameHost)) return;
    setBusy(true);
    try {
      await session.startGame();
    } finally {
      setBusy(false);
    }
  };

  const confirmLeave = () => {
    Alert.alert(
      isHost ? 'Stop hosting?' : 'Leave the game?',
      isHost ? 'The game ends for everyone.' : undefined,
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: isHost ? 'Stop' : 'Leave',
          style: 'destructive',
          onPress: () => {
            void leave().then(() => navigation.replace('Home'));
          },
        },
      ],
    );
  };

  const onMenu = () => {
    Alert.alert(
      state.gameName,
      `${view.players.length} players · ${view.drawPileCount} cards in the pile`,
      [
        { text: 'Back to game', style: 'cancel' },
        ...(connectionLost
          ? [{ text: 'Reconnect', onPress: () => navigation.navigate('Join') }]
          : []),
        {
          text: isHost ? 'Stop hosting' : 'Leave game',
          style: 'destructive' as const,
          onPress: confirmLeave,
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <TableBackground
        feltCenterY={feltCenterY}
        feltRadius={Math.min(width, height) * 0.4}
      />

      <View style={[styles.topBar, { marginTop: insets.top + spacing.sm }]}>
        <MenuButton onPress={onMenu} />
        <TurnPill text={pill.text} tone={pill.tone} />
        <View style={styles.topBarSpacer} />
      </View>

      <View style={{ height: seatsHeight }}>
        <OpponentSeats
          view={view}
          peers={state.peers}
          width={width}
          height={seatsHeight}
        />
      </View>

      <View style={styles.center}>
        {finished ? (
          <GameOverPanel
            view={view}
            isHost={isHost}
            onNewRound={() => void onNewRound()}
            onLeave={confirmLeave}
            busy={busy}
          />
        ) : (
          <CenterPile
            view={view}
            canDraw={interactive && moves.canDraw}
            onDraw={() => act(drawCard())}
          />
        )}
      </View>

      <View style={styles.actions}>
        {state.lastRejection ? (
          <Text style={styles.rejection}>{state.lastRejection.message}</Text>
        ) : null}
        {moves.canCloseTaki && interactive ? (
          <PrimaryButton
            title="Close TAKI"
            onPress={() => act(closeTaki())}
            style={styles.actionButton}
          />
        ) : null}
        {connectionLost ? (
          <PrimaryButton
            title="Reconnect"
            onPress={() => navigation.navigate('Join')}
            style={styles.actionButton}
          />
        ) : null}
      </View>

      <View style={[styles.hand, { paddingBottom: insets.bottom }]}>
        <HandFan
          hand={view.you.hand}
          playableIds={moves.playableCardIds}
          interactive={interactive}
          onPlay={onPlay}
        />
      </View>

      <ColorPicker
        visible={pendingWild !== null || (moves.mustChooseColor && interactive)}
        title={pendingWild ? 'Change color to…' : 'Choose the next color'}
        onPick={onPickColor}
        onCancel={pendingWild ? () => setPendingWild(null) : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  waiting: { color: colors.textMuted, textAlign: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  topBarSpacer: { width: 56 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.md },
  actions: { paddingHorizontal: spacing.md, gap: spacing.sm, minHeight: 8 },
  actionButton: { minHeight: 48 },
  rejection: { color: '#FFD3D4', textAlign: 'center', fontWeight: '600' },
  hand: { backgroundColor: 'rgba(0,0,0,0.12)' },
});
