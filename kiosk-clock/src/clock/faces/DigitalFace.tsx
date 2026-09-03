import { StyleSheet, Text, View } from 'react-native';

import { numerals, space, tracking } from '@/design/tokens';
import { label } from '@/design/palette';

import { timeParts } from '@/core/format';
import { NUMERAL_WEIGHT } from '../settings';
import type { FaceProps } from './types';

/** Single-line time, the way StandBy shows it: HH:MM with the tint on the digits. */
export function DigitalFace({ now, settings, accent, size }: FaceProps) {
  const { hours, minutes, seconds, suffix } = timeParts(now, settings.hour12);
  const weight = NUMERAL_WEIGHT[settings.weight];

  const digit = {
    ...numerals,
    fontSize: size,
    lineHeight: size * 1.08,
    letterSpacing: tracking(size),
    fontWeight: weight,
    color: accent.color,
  } as const;

  return (
    <View style={styles.row}>
      <Text style={digit} allowFontScaling={false}>
        {hours}
      </Text>
      <Text
        style={[digit, styles.colon]}
        allowFontScaling={false}
      >
        :
      </Text>
      <Text style={digit} allowFontScaling={false}>
        {minutes}
      </Text>

      {settings.showSeconds && (
        <Text
          style={{
            ...numerals,
            fontSize: size * 0.3,
            fontWeight: weight,
            color: label.secondary,
            marginLeft: size * 0.08,
          }}
          allowFontScaling={false}
        >
          {seconds}
        </Text>
      )}

      {suffix && (
        <Text
          style={{
            fontSize: size * 0.22,
            fontWeight: '600',
            color: label.tertiary,
            marginLeft: size * 0.08,
            letterSpacing: 0.5,
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
  // Same tint as the digits, stepped back so the pairs stay the focus.
  colon: { opacity: 0.5 },
  row: {
    flexDirection: 'row',
    // Baseline keeps the seconds and AM/PM sitting on the numerals' feet
    // rather than floating at their vertical centre.
    alignItems: 'baseline',
    paddingHorizontal: space.xs,
  },
});
