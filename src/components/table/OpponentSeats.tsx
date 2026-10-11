import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../app/theme';
import type { PlayerView } from '../../game';
import { PlayerKind } from '../../networking/protocol';
import type { SessionPeer } from '../../networking/session/SessionState';
import { CARD_SIZES, CardView } from '../cards/CardView';

interface OpponentSeatsProps {
  view: PlayerView;
  peers: SessionPeer[];
  /** Size of the area the seats are laid out in. */
  width: number;
  height: number;
}

const SEAT_W = 108;
const SEAT_H = 96;
const MAX_FAN = 8;

/**
 * The other players around the top of the table, in turn order clockwise from your left, each
 * with a fan of card backs and a name plate. The seat on turn glows and breathes.
 */
export function OpponentSeats({
  view,
  peers,
  width,
  height,
}: OpponentSeatsProps) {
  const me = view.players.findIndex(p => p.id === view.you.playerId);
  const ordered = [...view.players.slice(me + 1), ...view.players.slice(0, me)];
  const k = ordered.length;
  if (k === 0) return null;

  const cx = width / 2;
  const cy = height * 1.12;
  const rx = Math.max(60, width / 2 - SEAT_W / 2 - 6);
  const ry = Math.max(40, cy - SEAT_H / 2 - 4);

  return (
    <View style={{ width, height }} pointerEvents="none">
      {ordered.map((player, i) => {
        const theta = ((175 - (170 * (i + 0.5)) / k) * Math.PI) / 180;
        const x = cx + rx * Math.cos(theta) - SEAT_W / 2;
        const y = cy - ry * Math.sin(theta) - SEAT_H / 2;
        const peer = peers.find(p => p.playerId === player.id);
        const active =
          view.currentPlayerId === player.id && view.phase.kind !== 'Finished';
        return (
          <Seat
            key={player.id}
            name={player.name}
            cardCount={player.cardCount}
            active={active}
            offline={peer ? !peer.connected : false}
            bot={peer?.kind === PlayerKind.Bot}
            style={{ left: x, top: Math.max(0, y) }}
          />
        );
      })}
    </View>
  );
}

interface SeatProps {
  name: string;
  cardCount: number;
  active: boolean;
  offline: boolean;
  bot: boolean;
  style: { left: number; top: number };
}

function Seat({ name, cardCount, active, offline, bot, style }: SeatProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.07,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);

  const fan = Math.min(cardCount, MAX_FAN);
  const seat = CARD_SIZES.seat;
  const fanMid = (fan - 1) / 2;

  return (
    <Animated.View
      style={[
        styles.seat,
        style,
        offline && styles.seatOffline,
        { transform: [{ scale }] },
      ]}
    >
      <View style={styles.fan}>
        {Array.from({ length: fan }, (_, j) => (
          <View
            key={j}
            style={[
              styles.fanCard,
              {
                left: SEAT_W / 2 - seat.width / 2 + (j - fanMid) * 11,
                transform: [{ rotate: `${(j - fanMid) * 8}deg` }],
              },
            ]}
          >
            <CardView faceDown size="seat" />
          </View>
        ))}
        {cardCount === 0 ? <Text style={styles.out}>OUT</Text> : null}
      </View>
      <View style={[styles.plate, active && styles.plateActive]}>
        <Text
          style={[styles.name, active && styles.nameActive]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <View style={[styles.count, active && styles.countActive]}>
          <Text style={styles.countText}>{cardCount}</Text>
        </View>
      </View>
      {bot || offline ? (
        <Text style={styles.tag}>{offline ? 'reconnecting…' : 'bot'}</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  seat: {
    position: 'absolute',
    width: SEAT_W,
    height: SEAT_H,
    alignItems: 'center',
  },
  seatOffline: { opacity: 0.5 },
  fan: {
    width: SEAT_W,
    height: 54,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  fanCard: { position: 'absolute', bottom: 0 },
  out: { color: colors.accent, fontWeight: '900', letterSpacing: 2 },
  plate: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.plate,
    borderRadius: 16,
    paddingVertical: 5,
    paddingLeft: 12,
    paddingRight: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    maxWidth: SEAT_W,
  },
  plateActive: { borderColor: colors.accent, backgroundColor: '#FFF7DC' },
  name: {
    color: colors.textOnLight,
    fontWeight: '800',
    fontSize: 13,
    flexShrink: 1,
  },
  nameActive: { color: '#7A4B00' },
  count: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countActive: { backgroundColor: colors.accent },
  countText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  tag: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
