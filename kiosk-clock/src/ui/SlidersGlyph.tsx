import { View } from 'react-native';

/** Knob offsets along each track, giving the glyph its asymmetric rhythm. */
const KNOBS = [0.62, 0.3, 0.72];

/**
 * A three-slider "adjust" mark, drawn from primitives so the app doesn't pull
 * in an icon font for a single glyph.
 */
export function SlidersGlyph({
  size,
  color,
}: {
  size: number;
  color: string;
}) {
  const row = size * 0.22;
  const bar = Math.max(1.5, size * 0.07);

  return (
    <View style={{ width: size, height: size, justifyContent: 'space-between' }}>
      {KNOBS.map((position, index) => (
        <View key={index} style={{ height: row, justifyContent: 'center' }}>
          <View
            style={{
              height: bar,
              borderRadius: bar,
              backgroundColor: color,
              opacity: 0.5,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: position * (size - row),
              width: row,
              height: row,
              borderRadius: row / 2,
              backgroundColor: color,
            }}
          />
        </View>
      ))}
    </View>
  );
}
