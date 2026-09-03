import { Pressable, StyleSheet, View } from 'react-native';

import { ACCENTS, type AccentId } from '@/design/palette';
import { radius, space } from '@/design/tokens';

const DOT = 26;
/** Touch/selection ring drawn around each dot. */
const RING = DOT + 8;

/** Accent picker: a ring, rather than a checkmark, marks the selection. */
export function Swatches({
  value,
  onChange,
}: {
  value: AccentId;
  onChange: (next: AccentId) => void;
}) {
  return (
    <View style={styles.row}>
      {ACCENTS.map((accent) => {
        const selected = accent.id === value;

        return (
          <Pressable
            key={accent.id}
            onPress={() => onChange(accent.id)}
            accessibilityRole="radio"
            accessibilityLabel={accent.name}
            accessibilityState={{ selected }}
            hitSlop={space.xs}
            style={({ pressed }) => [
              styles.ring,
              selected && { borderColor: accent.color },
              pressed && { opacity: 0.6 },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: accent.color }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // No wrapping: the full palette is meant to read as a single row.
    justifyContent: 'space-between',
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
});
