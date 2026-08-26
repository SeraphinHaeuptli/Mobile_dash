import { StyleSheet, Text, View } from 'react-native';

import { numerals, tracking } from '@/design/tokens';
import { label } from '@/design/palette';

import { timeParts } from '@/core/format';
import { NUMERAL_WEIGHT } from '../settings';
import type { FaceProps } from './types';

const SCALE = 2.3;

/** Hours over minutes at maximum size — readable across a room. */
export function StackFace({ now, settings, accent, size }: FaceProps) {
  const { hours, minutes, suffix } = timeParts(now, settings.hour12);
  const font = size * SCALE;
  const weight = NUMERAL_WEIGHT[settings.weight];

  const digit = {
    ...numerals,
    fontSize: font,
    // Leading below 1.0 tightens the two rows into a single visual block.
    lineHeight: font * 0.92,
    letterSpacing: tracking(font),
    fontWeight: weight,
    textAlign: 'center',
  } as const;

  return (
    <View style={styles.stack}>
      <Text style={[digit, { color: label.primary }]} allowFontScaling={false}>
        {hours}
      </Text>
      <Text style={[digit, { color: accent.color }]} allowFontScaling={false}>
        {minutes}
      </Text>

      {suffix && (
        <Text
          style={{
            fontSize: font * 0.14,
            fontWeight: '600',
            color: label.tertiary,
            letterSpacing: 2,
            marginTop: font * 0.06,
          }}
          allowFontScaling={false}
        >
          {suffix}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: 'center' },
});
