import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { surface, withAlpha, type Accent } from '@/design/palette';

import type { BackdropId } from './settings';

/** Peak opacity at the centre of a wash, fading to nothing at its edge. */
const GLOW_ALPHA = 0.26;

/**
 * A soft circular wash.
 *
 * React Native has no radial gradient primitive, and stacking concentric views
 * to fake one leaves visible banding on a black screen. SVG gives a real radial
 * gradient, so the falloff is genuinely smooth at any size.
 */
function Glow({
  size,
  color,
  style,
}: {
  size: number;
  color: string;
  style: ViewStyle;
}) {
  // Stable per-colour id: two washes on screen must not share a gradient def.
  const id = `glow-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={GLOW_ALPHA} />
            <Stop offset="0.55" stopColor={color} stopOpacity={GLOW_ALPHA * 0.4} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function Backdrop({
  backdrop,
  accent,
}: {
  backdrop: BackdropId;
  accent: Accent;
}) {
  const { width, height } = useWindowDimensions();

  if (backdrop === 'black') {
    return <View style={[StyleSheet.absoluteFill, styles.base]} />;
  }

  if (backdrop === 'gradient') {
    return (
      <View style={[StyleSheet.absoluteFill, styles.base]}>
        <LinearGradient
          colors={[
            withAlpha(accent.color, 0.3),
            withAlpha(accent.companion, 0.08),
            'rgba(0,0,0,0)',
          ]}
          locations={[0, 0.42, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  // Aurora: two washes anchored off-screen so no circular edge is ever visible.
  return (
    <View style={[StyleSheet.absoluteFill, styles.base]}>
      <Glow
        size={width * 1.7}
        color={accent.color}
        style={{ position: 'absolute', top: -height * 0.24, left: -width * 0.5 }}
      />
      <Glow
        size={width * 1.5}
        color={accent.companion}
        style={{
          position: 'absolute',
          bottom: -height * 0.22,
          right: -width * 0.45,
        }}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']}
        locations={[0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: surface.kiosk, overflow: 'hidden' },
});
