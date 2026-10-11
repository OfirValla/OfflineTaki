import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../../app/theme';
import { CardKind, Color, cardColor, type Card } from '../../game';
import {
  ColorCubesGlyph,
  PlusGlyph,
  ReverseGlyph,
  StopGlyph,
} from './CardGlyphs';

export type CardSize = 'hand' | 'pile' | 'mini' | 'seat';

export interface CardDims {
  width: number;
  height: number;
}

export const CARD_SIZES: Record<CardSize, CardDims> = {
  hand: { width: 84, height: 124 },
  pile: { width: 88, height: 130 },
  mini: { width: 44, height: 64 },
  seat: { width: 30, height: 44 },
};

export const CARD_COLORS: Record<Color, string> = {
  [Color.Red]: colors.red,
  [Color.Blue]: colors.blue,
  [Color.Green]: colors.green,
  [Color.Yellow]: colors.yellow,
};

export const CARD_SHADES: Record<Color, string> = {
  [Color.Red]: colors.redDark,
  [Color.Blue]: colors.blueDark,
  [Color.Green]: colors.greenDark,
  [Color.Yellow]: colors.yellowDark,
};

interface CardViewProps {
  card?: Card;
  /** Renders the card back (draw pile, other players' hands). */
  faceDown?: boolean;
  size?: CardSize;
  /** Playable right now: gold frame, lifted. */
  highlighted?: boolean;
  /** Not playable: muted. */
  dimmed?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** A TAKI card: white face, bold coloured numeral or symbol with a 3D shade, small corner marks. */
export function CardView({
  card,
  faceDown = false,
  size = 'hand',
  highlighted = false,
  dimmed = false,
  onPress,
  disabled,
  style,
  accessibilityLabel,
}: CardViewProps) {
  const dims = CARD_SIZES[size];
  const frame: StyleProp<ViewStyle> = [
    styles.frame,
    {
      width: dims.width,
      height: dims.height,
      borderRadius: Math.round(dims.width * 0.12),
    },
    highlighted && styles.highlighted,
    dimmed && styles.dimmed,
    style,
  ];
  const content =
    faceDown || !card ? (
      <CardBack dims={dims} />
    ) : (
      <CardFace card={card} dims={dims} />
    );

  if (!onPress) {
    return (
      <View style={frame} accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [frame, pressed && !disabled && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

function CardFace({ card, dims }: { card: Card; dims: CardDims }) {
  const color = cardColor(card);
  const fill = color ? CARD_COLORS[color] : colors.textOnLight;
  const shade = color ? CARD_SHADES[color] : '#0B1A33';
  const glyphSize = Math.round(dims.width * 0.62);
  const corner = Math.max(8, Math.round(dims.width * 0.16));
  const cornerText = cornerMark(card);

  return (
    <View style={styles.face}>
      <Text
        style={[
          styles.corner,
          styles.cornerTop,
          { color: fill, fontSize: corner },
        ]}
      >
        {cornerText}
      </Text>
      <Text
        style={[
          styles.corner,
          styles.cornerBottom,
          { color: fill, fontSize: corner },
        ]}
      >
        {cornerText}
      </Text>
      <View style={styles.center}>
        {renderGlyph(card, fill, shade, glyphSize, dims)}
      </View>
    </View>
  );
}

function renderGlyph(
  card: Card,
  fill: string,
  shade: string,
  glyphSize: number,
  dims: CardDims,
): React.ReactNode {
  switch (card.kind) {
    case CardKind.Number:
      return (
        <Numeral
          text={String(card.value)}
          fill={fill}
          shade={shade}
          fontSize={Math.round(dims.width * 0.8)}
        />
      );
    case CardKind.Stop:
      return <StopGlyph size={glyphSize} color={fill} shade={shade} />;
    case CardKind.Plus:
      return <PlusGlyph size={glyphSize} color={fill} shade={shade} />;
    case CardKind.ChangeDirection:
      return <ReverseGlyph size={glyphSize} color={fill} shade={shade} />;
    case CardKind.Taki:
      return (
        <View style={styles.takiStack}>
          <Numeral
            text="TA"
            fill={fill}
            shade={shade}
            fontSize={Math.round(dims.width * 0.36)}
            tight
          />
          <Numeral
            text="KI"
            fill={fill}
            shade={shade}
            fontSize={Math.round(dims.width * 0.36)}
            tight
          />
        </View>
      );
    case CardKind.ChangeColor:
      return <ColorCubesGlyph size={glyphSize} />;
  }
}

/** A bold numeral with a darker copy offset behind it, like an embossed print. */
function Numeral({
  text,
  fill,
  shade,
  fontSize,
  tight = false,
}: {
  text: string;
  fill: string;
  shade: string;
  fontSize: number;
  tight?: boolean;
}) {
  const lineHeight = tight ? fontSize * 0.98 : fontSize * 1.05;
  const base = [styles.numeral, { fontSize, lineHeight }];
  return (
    <View style={styles.numeralBox}>
      <Text style={[base, styles.numeralShade, { color: shade }]}>{text}</Text>
      <Text style={[base, { color: fill }]}>{text}</Text>
    </View>
  );
}

function cornerMark(card: Card): string {
  switch (card.kind) {
    case CardKind.Number:
      return String(card.value);
    case CardKind.Stop:
      return '✋';
    case CardKind.Plus:
      return '+';
    case CardKind.ChangeDirection:
      return '⇄';
    case CardKind.Taki:
      return 'T';
    case CardKind.ChangeColor:
      return '✦';
  }
}

/** Red "TAKI" diagonal print on a white card back. */
function CardBack({ dims }: { dims: CardDims }) {
  const fontSize = Math.max(6, Math.round(dims.width * 0.14));
  const rows = Math.ceil((dims.height * 3) / (fontSize * 1.2));
  return (
    <View style={[styles.face, styles.back]}>
      <View
        style={[
          styles.backPattern,
          {
            left: -dims.width,
            top: -dims.height,
            width: dims.width * 3,
            height: dims.height * 3,
            transform: [{ rotate: '-32deg' }],
          },
        ]}
      >
        {Array.from({ length: rows }, (_, i) => (
          <Text
            key={i}
            numberOfLines={1}
            style={[
              styles.backText,
              {
                fontSize,
                lineHeight: fontSize * 1.2,
                marginLeft: (i % 2) * fontSize,
              },
            ]}
          >
            {'TAKI '.repeat(24)}
          </Text>
        ))}
      </View>
      <View
        style={[
          styles.backInset,
          { borderRadius: Math.round(dims.width * 0.08) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E4EAF3',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  highlighted: { borderColor: colors.accent, borderWidth: 3, elevation: 10 },
  dimmed: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  face: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', fontWeight: '900' },
  cornerTop: { top: 2, left: 5 },
  cornerBottom: { bottom: 2, right: 5, transform: [{ rotate: '180deg' }] },
  numeralBox: { alignItems: 'center', justifyContent: 'center' },
  numeral: {
    fontWeight: '900',
    includeFontPadding: false,
    textAlign: 'center',
  },
  numeralShade: { position: 'absolute', left: 3, top: 4 },
  takiStack: { alignItems: 'center' },
  back: { backgroundColor: '#FFFFFF' },
  backPattern: { position: 'absolute' },
  backText: {
    color: colors.red,
    fontWeight: '900',
    letterSpacing: 1,
    opacity: 0.85,
  },
  backInset: {
    position: 'absolute',
    left: 4,
    top: 4,
    right: 4,
    bottom: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
});
