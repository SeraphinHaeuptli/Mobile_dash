import { useEffect, useRef } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

const CYCLE_MS = 90_000;
const DRIFT_X = 8;
const DRIFT_Y = 10;

/**
 * Nudges its children a few points on a slow cycle. A kiosk clock holds the
 * same bright pixels for hours, which is exactly what burns OLED panels; the
 * motion is far too slow to notice but enough to spread the load.
 */
export function BurnInGuard({
  enabled,
  style,
  children,
}: {
  enabled: boolean;
  style?: ViewStyle;
  children: ReactNode;
}) {
  const drift = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!enabled) {
      drift.setValue(0.5);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: CYCLE_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: CYCLE_MS * 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0.5,
          duration: CYCLE_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [enabled, drift]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            {
              translateX: drift.interpolate({
                inputRange: [0, 1],
                outputRange: [-DRIFT_X, DRIFT_X],
              }),
            },
            {
              // Opposed to X so the path traces an arc, not a diagonal line.
              translateY: drift.interpolate({
                inputRange: [0, 1],
                outputRange: [DRIFT_Y, -DRIFT_Y],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
