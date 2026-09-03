import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { formatDuration, formatPercent } from '@/core/format';
import { useNow } from '@/core/useNow';
import { label, surface } from '@/design/palette';
import { duration, hairline, numerals, radius, space, type } from '@/design/tokens';

import { levelColor, levelOf, timeUntilReset, type UsageResult } from './usage';

const TRACK_HEIGHT = 5;

function ModePill({ mode }: { mode: UsageResult['mode'] }) {
  if (mode === 'live') return null;
  const stale = mode === 'stale';

  return (
    <View
      style={[
        styles.pill,
        stale && { backgroundColor: 'rgba(255,159,10,0.16)' },
      ]}
    >
      <Text
        style={[
          styles.pillText,
          { color: stale ? '#FF9F0A' : label.tertiary },
        ]}
      >
        {stale ? 'stale' : 'sample'}
      </Text>
    </View>
  );
}

interface Props {
  result: UsageResult | null;
  accentColor: string;
}

/**
 * The Claude session meter. Shows how much of the rolling five-hour allowance
 * is gone and when it rolls over; the weekly allowance rides along on the right.
 */
export function UsageBar({ result, accentColor }: Props) {
  // Its own minute tick: the countdown must keep moving even when the face
  // above it is only redrawing once an hour.
  const now = useNow('minute').getTime();
  const fill = useRef(new Animated.Value(0)).current;

  const used = result?.snapshot.session.used ?? 0;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: used,
      duration: duration.slow,
      // Width cannot be driven natively; this animates once a minute at most.
      useNativeDriver: false,
    }).start();
  }, [fill, used]);

  if (!result) return null;

  const { session, week } = result.snapshot;
  const color = levelColor(levelOf(used), accentColor);
  const remaining = timeUntilReset(session, now);

  const width = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>Claude session</Text>
        <Text style={[styles.percent, { color }]} allowFontScaling={false}>
          {formatPercent(used)}
        </Text>
      </View>

      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { width, backgroundColor: color }]}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.footerLeft}>
          <Text style={styles.meta}>
            {remaining === 0
              ? 'Resetting now'
              : `Resets in ${formatDuration(remaining)}`}
          </Text>
          <ModePill mode={result.mode} />
        </View>

        {week && (
          <Text style={styles.meta} allowFontScaling={false}>
            Week {formatPercent(week.used)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.glass,
    borderColor: surface.glassBorder,
    borderWidth: hairline,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  title: {
    ...type.footnote,
    color: label.secondary,
    fontWeight: '600',
  },
  percent: {
    ...numerals,
    fontSize: 15,
    fontWeight: '600',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
  },
  meta: {
    ...type.caption,
    color: label.tertiary,
    fontWeight: '400',
  },
  pill: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
