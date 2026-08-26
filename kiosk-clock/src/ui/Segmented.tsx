import { Pressable, StyleSheet, Text, View } from 'react-native';

import { label, surface } from '@/design/palette';
import { radius, space, type } from '@/design/tokens';

export interface Segment<T extends string> {
  id: T;
  name: string;
}

/** iOS segmented control: the selection is a raised pill, not a tinted one. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly Segment<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.id === value;

        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && !selected && styles.segmentPressed,
            ]}
          >
            <Text
              style={[styles.text, selected && styles.textSelected]}
              numberOfLines={1}
            >
              {option.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: 'rgba(118,118,128,0.24)',
    borderRadius: 9,
    borderCurve: 'continuous',
    padding: 2,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: space.sm,
    borderRadius: 7,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: '#636366' },
  segmentPressed: { opacity: 0.6 },
  text: {
    ...type.footnote,
    fontWeight: '500',
    color: label.secondary,
  },
  textSelected: { color: label.primary, fontWeight: '600' },
});
