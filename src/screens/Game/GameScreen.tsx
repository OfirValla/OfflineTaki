import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
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
import { ReactionBubble } from '../../components/reactions/ReactionBubble';
import { ReactionTray } from '../../components/reactions/ReactionTray';
import { CenterPile } from '../../components/table/CenterPile';
import { MenuButton } from '../../components/table/MenuButton';
import { OpponentSeats } from '../../components/table/OpponentSeats';
import { TableBackground } from '../../components/table/TableBackground';
import { TurnPill, type PillTone } from '../../components/table/TurnPill';
import { useSessionState } from '../../hooks/useSessionState';
import { useTick } from '../../hooks/useTick';
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
import {
  REACTION_DISPLAY_MS,
  type ReactionEmoji,
} from '../../networking/protocol';
import type { Reaction } from '../../networking/session/SessionState';

export function GameScreen({ navigation }: ScreenProps<'Game'>) {
  const { session, leave, settings, setSoundEnabled } = useSessionApi();
  const state = useSessionState(session);
  const view = state?.game ?? null;
  // Cheap to recompute; derived directly so it can never lag behind the view.
  const moves = session && view ? session.legalMoves() : null;
  const [pendingWild, setPendingWild] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Reaction bubbles expire on a timer; tick only while any could still be visible.
  const newestReactionAt = state?.reactions.at(-1)?.at ?? 0;
  const now = useTick(Date.now() - newestReactionAt < REACTION_DISPLAY_MS, 400);
  const liveReactions = latestLiveReactions(state?.reactions ?? [], now);

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
  const myReaction = liveReactions[state.self.playerId];

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

  const onReact = (emoji: ReactionEmoji) => {
    setTrayOpen(false);
    void session.sendReaction(emoji);
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
        {
          text: settings.soundEnabled ? 'Mute sounds' : 'Unmute sounds',
          onPress: () => void setSoundEnabled(!settings.soundEnabled),
        },
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
        <Pressable
          onPress={() => setTrayOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Send a reaction"
          hitSlop={8}
          style={({ pressed }) => [
            styles.reactButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.reactIcon}>😀</Text>
        </Pressable>
      </View>

      <View style={{ height: seatsHeight }}>
        <OpponentSeats
          view={view}
          peers={state.peers}
          width={width}
          height={seatsHeight}
          reactions={liveReactions}
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
        {myReaction ? (
          <View style={styles.myBubble} pointerEvents="none">
            <ReactionBubble
              key={myReaction.id}
              reaction={myReaction}
              tail="down"
            />
          </View>
        ) : null}
        <HandFan
          hand={view.you.hand}
          playableIds={moves.playableCardIds}
          interactive={interactive}
          onPlay={onPlay}
        />
      </View>

      <ReactionTray
        visible={trayOpen}
        onPick={onReact}
        onClose={() => setTrayOpen(false)}
      />

      <ColorPicker
        visible={pendingWild !== null || (moves.mustChooseColor && interactive)}
        title={pendingWild ? 'Change color to…' : 'Choose the next color'}
        onPick={onPickColor}
        onCancel={pendingWild ? () => setPendingWild(null) : undefined}
      />
    </View>
  );
}

/** The newest reaction per player that is still within its display window. */
function latestLiveReactions(
  reactions: Reaction[],
  now: number,
): Record<string, Reaction> {
  const live: Record<string, Reaction> = {};
  for (const reaction of reactions) {
    if (now - reaction.at < REACTION_DISPLAY_MS)
      live[reaction.playerId] = reaction;
  }
  return live;
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
  reactButton: {
    width: 56,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactIcon: { fontSize: 18 },
  pressed: { opacity: 0.8 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.md },
  actions: { paddingHorizontal: spacing.md, gap: spacing.sm, minHeight: 8 },
  actionButton: { minHeight: 48 },
  rejection: { color: '#FFD3D4', textAlign: 'center', fontWeight: '600' },
  hand: { backgroundColor: 'rgba(0,0,0,0.12)' },
  myBubble: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
});
