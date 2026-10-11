import React from 'react';
import Svg, { G, Path, Polygon, Rect } from 'react-native-svg';
import { colors } from '../../app/theme';

/**
 * Vector symbols for the action cards, drawn in a 64×64 box with a darker offset copy behind
 * them for the chunky 3D look of the printed cards.
 */

interface GlyphProps {
  size: number;
  color: string;
  shade: string;
}

const LIFT = 3;

function Extruded({
  size,
  shade,
  children,
}: {
  size: number;
  shade: string;
  children: (fill: string) => React.ReactNode;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <G x={LIFT} y={LIFT + 1}>
        {children(shade)}
      </G>
      <G>{children('__front__')}</G>
    </Svg>
  );
}

export function StopGlyph({ size, color, shade }: GlyphProps) {
  return (
    <Extruded size={size} shade={shade}>
      {fill => {
        const f = fill === '__front__' ? color : fill;
        return (
          <>
            <Rect x={16} y={12} width={9} height={30} rx={4.5} fill={f} />
            <Rect x={27} y={6} width={9} height={36} rx={4.5} fill={f} />
            <Rect x={38} y={9} width={9} height={33} rx={4.5} fill={f} />
            <Rect x={49} y={16} width={8} height={26} rx={4} fill={f} />
            <Rect
              x={2}
              y={28}
              width={15}
              height={22}
              rx={7}
              fill={f}
              transform="rotate(-28 9.5 39)"
            />
            <Rect x={16} y={30} width={41} height={28} rx={11} fill={f} />
          </>
        );
      }}
    </Extruded>
  );
}

export function ReverseGlyph({ size, color, shade }: GlyphProps) {
  return (
    <Extruded size={size} shade={shade}>
      {fill => {
        const f = fill === '__front__' ? color : fill;
        return (
          <>
            <Path
              d="M 14 27 A 18 18 0 0 1 50 27"
              stroke={f}
              strokeWidth={7}
              strokeLinecap="round"
              fill="none"
            />
            <Polygon points="40,27 60,27 50,40" fill={f} />
            <Path
              d="M 50 37 A 18 18 0 0 1 14 37"
              stroke={f}
              strokeWidth={7}
              strokeLinecap="round"
              fill="none"
            />
            <Polygon points="4,37 24,37 14,24" fill={f} />
          </>
        );
      }}
    </Extruded>
  );
}

export function PlusGlyph({ size, color, shade }: GlyphProps) {
  return (
    <Extruded size={size} shade={shade}>
      {fill => {
        const f = fill === '__front__' ? color : fill;
        return (
          <>
            <Rect x={25} y={6} width={14} height={52} rx={5} fill={f} />
            <Rect x={6} y={25} width={52} height={14} rx={5} fill={f} />
          </>
        );
      }}
    </Extruded>
  );
}

/** The four-colour cubes of the Change Color card. */
export function ColorCubesGlyph({ size }: { size: number }) {
  const cubes: Array<{ x: number; y: number; fill: string; shade: string }> = [
    { x: 5, y: 5, fill: colors.red, shade: colors.redDark },
    { x: 34, y: 5, fill: colors.blue, shade: colors.blueDark },
    { x: 5, y: 34, fill: colors.green, shade: colors.greenDark },
    { x: 34, y: 34, fill: colors.yellow, shade: colors.yellowDark },
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {cubes.map(c => (
        <G key={c.fill}>
          <Rect
            x={c.x + 3}
            y={c.y + 4}
            width={25}
            height={25}
            rx={6}
            fill={c.shade}
          />
          <Rect x={c.x} y={c.y} width={25} height={25} rx={6} fill={c.fill} />
          <Rect
            x={c.x + 4}
            y={c.y + 4}
            width={11}
            height={6}
            rx={3}
            fill="rgba(255,255,255,0.45)"
          />
        </G>
      ))}
    </Svg>
  );
}
