import { StyleSheet, View } from 'react-native';

import { label } from '@/design/palette';

import type { FaceProps } from './types';

const DIAL_SCALE = 3.0;

interface HandProps {
  dial: number;
  angle: number;
  length: number;
  width: number;
  color: string;
  /** How far the hand overhangs the pivot, as real watch hands do. */
  tail?: number;
}

/**
 * A hand is drawn pointing straight up inside a square that is rotated as a
 * whole. Rotating the square means the pivot is its centre — the dial centre —
 * without relying on transform-origin support.
 */
function Hand({ dial, angle, length, width, color, tail = 0 }: HandProps) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { transform: [{ rotate: `${angle}deg` }] },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          left: dial / 2 - width / 2,
          top: dial / 2 - length,
          width,
          height: length + tail,
          borderRadius: width / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Twelve o'clock markers, one every 30°. */
function Ticks({ dial }: { dial: number }) {
  const width = Math.max(2, dial * 0.012);
  const height = dial * 0.05;
  const inset = dial * 0.045;

  return (
    <>
      {Array.from({ length: 12 }, (_, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ rotate: `${index * 30}deg` }] },
          ]}
        >
          <View
            style={{
              position: 'absolute',
              left: dial / 2 - width / 2,
              top: inset,
              width,
              height,
              borderRadius: width / 2,
              // The quarters read as the anchors, the rest as guides.
              backgroundColor:
                index % 3 === 0 ? label.secondary : label.quaternary,
            }}
          />
        </View>
      ))}
    </>
  );
}

export function AnalogFace({ now, settings, accent, size }: FaceProps) {
  const dial = size * DIAL_SCALE;

  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // The hour hand creeps between markers, and the minute hand between ticks.
  const hourAngle = hours * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const secondAngle = seconds * 6;

  const cap = Math.max(6, dial * 0.035);

  return (
    <View
      style={[
        styles.dial,
        { width: dial, height: dial, borderRadius: dial / 2 },
      ]}
    >
      <Ticks dial={dial} />

      <Hand
        dial={dial}
        angle={hourAngle}
        length={dial * 0.27}
        width={Math.max(4, dial * 0.028)}
        color={label.primary}
        tail={dial * 0.05}
      />
      <Hand
        dial={dial}
        angle={minuteAngle}
        length={dial * 0.39}
        width={Math.max(3, dial * 0.021)}
        color={label.primary}
        tail={dial * 0.05}
      />
      {settings.showSeconds && (
        <Hand
          dial={dial}
          angle={secondAngle}
          length={dial * 0.42}
          width={Math.max(1.5, dial * 0.008)}
          color={accent.color}
          tail={dial * 0.09}
        />
      )}

      <View
        style={{
          width: cap,
          height: cap,
          borderRadius: cap / 2,
          backgroundColor: accent.color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dial: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
});
