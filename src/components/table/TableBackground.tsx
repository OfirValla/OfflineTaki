import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

interface TableBackgroundProps {
  /** Centre of the lighter felt disc; defaults to a little above the middle of the screen. */
  feltCenterY?: number;
  feltRadius?: number;
  /** Hide the felt disc on screens that are not a table (home, lobby). */
  showFelt?: boolean;
}

/** The blue table: a radial gradient with a soft lit disc where the cards land. */
export function TableBackground({
  feltCenterY,
  feltRadius,
  showFelt = true,
}: TableBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const cy = feltCenterY ?? height * 0.46;
  const r = feltRadius ?? Math.min(width, height) * 0.42;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="tableBg" cx="50%" cy="40%" rx="80%" ry="70%">
            <Stop offset="0" stopColor="#3F93DA" />
            <Stop offset="0.55" stopColor="#1E63AD" />
            <Stop offset="1" stopColor="#0A2F5E" />
          </RadialGradient>
          <RadialGradient id="felt" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#8AC6F5" stopOpacity="0.7" />
            <Stop offset="0.65" stopColor="#4C97DB" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#3B87CF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#tableBg)" />
        {showFelt ? (
          <>
            <Circle cx={width / 2} cy={cy} r={r} fill="url(#felt)" />
            <Circle
              cx={width / 2}
              cy={cy}
              r={r * 0.7}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={10}
              fill="none"
            />
            <Circle
              cx={width / 2}
              cy={cy}
              r={r * 0.98}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={3}
              fill="none"
            />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
