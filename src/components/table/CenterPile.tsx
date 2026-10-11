import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { colors, spacing } from '../../app/theme';
import type { Card, PlayerView } from '../../game';
import { CARD_COLORS, CARD_SIZES, CardView } from '../cards/CardView';

interface CenterPileProps {
  view: PlayerView;
  canDraw: boolean;
  onDraw: () => void;
}

const ARROW_BOX = 232;
const ARROW_R = 98;
const STACK_DEPTH = 3;

interface StackEntry {
  card: Card;
  rotation: number;
}

/** Discard stack with direction arrows around it, the draw pile beside it, and the colour in force. */
export function CenterPile({ view, canDraw, onDraw }: CenterPileProps) {
  const [stack, setStack] = useState<StackEntry[]>(() => [
    { card: view.topCard, rotation: rotationFor(view.topCard.id) },
  ]);
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const top = stack[stack.length - 1];
    if (top && top.card.id === view.topCard.id) return;
    setStack(current =>
      [
        ...current,
        { card: view.topCard, rotation: rotationFor(view.topCard.id) },
      ].slice(-STACK_DEPTH),
    );
    pop.setValue(1.28);
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [view.topCard, stack, pop]);

  const pile = CARD_SIZES.pile;
  const arrowColor = CARD_COLORS[view.activeColor];

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <View style={[styles.colorChip, { backgroundColor: arrowColor }]} />
        <Text style={styles.caption}>{view.activeColor}</Text>
      </View>

      <View style={styles.pileBox}>
        <View
          style={[
            styles.arrows,
            view.direction === -1 && styles.arrowsMirrored,
          ]}
          pointerEvents="none"
        >
          <DirectionArrows color={arrowColor} />
        </View>
        {stack.map((entry, i) => {
          const isTop = i === stack.length - 1;
          return (
            <Animated.View
              key={entry.card.id}
              style={[
                styles.stacked,
                {
                  transform: [
                    { rotate: `${entry.rotation}deg` },
                    { scale: isTop ? pop : 1 },
                  ],
                  zIndex: i,
                },
                !isTop && styles.stackedUnder,
              ]}
            >
              <CardView card={entry.card} size="pile" />
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.side}>
        <Pressable
          onPress={onDraw}
          disabled={!canDraw}
          accessibilityRole="button"
          accessibilityLabel={`Draw pile, ${view.drawPileCount} cards${
            canDraw ? ', tap to draw' : ''
          }`}
          style={({ pressed }) => [
            styles.drawPile,
            { width: pile.width + 8, height: pile.height + 8 },
            pressed && canDraw && styles.pressed,
          ]}
        >
          {[2, 1, 0].map(depth => (
            <View
              key={depth}
              style={[styles.drawCard, { left: depth * 3, top: -depth * 3 }]}
            >
              <CardView
                faceDown
                size="pile"
                highlighted={depth === 0 && canDraw}
              />
            </View>
          ))}
        </Pressable>
        <Text style={[styles.caption, canDraw && styles.captionActive]}>
          {canDraw ? 'Tap to draw' : `${view.drawPileCount} left`}
        </Text>
      </View>
    </View>
  );
}

function DirectionArrows({ color }: { color: string }) {
  const c = ARROW_BOX / 2;
  const top = arc(c, c, ARROW_R, -68, 68);
  const bottom = arc(c, c, ARROW_R, 112, 248);
  return (
    <Svg width={ARROW_BOX} height={ARROW_BOX}>
      {[top, bottom].map((a, i) => (
        <React.Fragment key={i}>
          <Path
            d={a.d}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={12}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={a.d}
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
          />
          <Polygon points={a.head} fill={color} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

/** Arc drawn clockwise from `a0` to `a1` degrees (0 = top), with an arrowhead at the end. */
function arc(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
): { d: string; head: string } {
  const p = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
  };
  const start = p(a0);
  const end = p(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  const d = `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
  const t = (a1 * Math.PI) / 180;
  const tangent = { x: Math.cos(t), y: Math.sin(t) };
  const normal = { x: -tangent.y, y: tangent.x };
  const tip = { x: end.x + tangent.x * 16, y: end.y + tangent.y * 16 };
  const l = { x: end.x + normal.x * 9, y: end.y + normal.y * 9 };
  const rgt = { x: end.x - normal.x * 9, y: end.y - normal.y * 9 };
  return { d, head: `${tip.x},${tip.y} ${l.x},${l.y} ${rgt.x},${rgt.y}` };
}

function rotationFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return (h % 25) - 12;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  side: {
    alignItems: 'center',
    gap: spacing.xs,
    width: CARD_SIZES.pile.width + 12,
  },
  pileBox: {
    width: CARD_SIZES.pile.width + 24,
    height: CARD_SIZES.pile.height + 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrows: {
    position: 'absolute',
    width: ARROW_BOX,
    height: ARROW_BOX,
    left: (CARD_SIZES.pile.width + 24 - ARROW_BOX) / 2,
    top: (CARD_SIZES.pile.height + 24 - ARROW_BOX) / 2,
  },
  arrowsMirrored: { transform: [{ scaleX: -1 }] },
  stacked: { position: 'absolute' },
  stackedUnder: { opacity: 0.92 },
  drawPile: { alignItems: 'flex-start', justifyContent: 'flex-end' },
  drawCard: { position: 'absolute', bottom: 0 },
  pressed: { opacity: 0.85 },
  colorChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    elevation: 3,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  captionActive: { color: colors.accent, fontWeight: '700' },
});
