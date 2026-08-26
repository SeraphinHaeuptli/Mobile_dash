import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { label, surface, type Accent } from '@/design/palette';
import { radius, space, type } from '@/design/tokens';

import { FACES } from './faces';
import type { ClockSettings, FaceId } from './settings';

const CARD_WIDTH = 152;
const CARD_HEIGHT = 96;

/**
 * Watch-face style picker. Each card renders the real face component at
 * thumbnail scale with the user's live settings, so the preview is the product
 * rather than a drawing of it.
 */
export function FacePicker({
  now,
  settings,
  accent,
  onChange,
}: {
  now: Date;
  settings: ClockSettings;
  accent: Accent;
  onChange: (face: FaceId) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.track}
    >
      {FACES.map((face) => {
        const selected = face.id === settings.face;

        return (
          <Pressable
            key={face.id}
            onPress={() => onChange(face.id)}
            accessibilityRole="radio"
            accessibilityLabel={`${face.name} face`}
            accessibilityState={{ selected }}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View
              style={[
                styles.card,
                selected && { borderColor: accent.color },
              ]}
            >
              <face.Component
                now={now}
                settings={{ ...settings, face: face.id }}
                accent={accent}
                size={face.previewSize}
              />
            </View>

            <Text
              style={[styles.name, selected && styles.nameSelected]}
              numberOfLines={1}
            >
              {face.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: { gap: space.md, paddingRight: space.lg },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: surface.kiosk,
    borderWidth: 2,
    borderColor: surface.control,
    alignItems: 'center',
    justifyContent: 'center',
    // Long word-clock phrases are clipped rather than allowed to stretch the card.
    overflow: 'hidden',
  },
  pressed: { opacity: 0.6 },
  name: {
    ...type.footnote,
    color: label.tertiary,
    textAlign: 'center',
    marginTop: space.xs,
  },
  nameSelected: { color: label.primary, fontWeight: '600' },
});
