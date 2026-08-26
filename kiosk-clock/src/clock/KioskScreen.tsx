import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { longDate } from '@/core/format';
import { useNow } from '@/core/useNow';
import { label, surface } from '@/design/palette';
import { duration, hairline, radius, space, type } from '@/design/tokens';
import { SlidersGlyph } from '@/ui/SlidersGlyph';
import { UsageBar } from '@/usage/UsageBar';
import { resolveEndpoint, useUsage } from '@/usage/useUsage';

import { Backdrop } from './Backdrop';
import { BurnInGuard } from './BurnInGuard';
import { ClockFace } from './ClockFace';
import { useSettings } from './SettingsContext';
import { isNight } from './settings';

const KEEP_AWAKE_TAG = 'kiosk-clock';
const CHROME_TIMEOUT_MS = 4_000;
const NIGHT_OPACITY = 0.45;

export function KioskScreen() {
  const { settings, accent, ready } = useSettings();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Only pay for a per-second re-render when something actually moves each
  // second: the seconds readout, or the analog hands.
  const now = useNow(
    settings.showSeconds || settings.face === 'analog' ? 'second' : 'minute',
  );

  const usage = useUsage(
    resolveEndpoint(settings.usageEndpoint),
    settings.showUsage,
  );

  /* -- Kiosk behaviours ---------------------------------------------------- */

  useEffect(() => {
    if (!settings.keepAwake) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [settings.keepAwake]);

  useEffect(() => {
    ScreenOrientation.lockAsync(
      settings.landscape
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => {
      // Orientation locking is unavailable on some devices; not fatal.
    });
  }, [settings.landscape]);

  /* -- Night dimming ------------------------------------------------------- */

  const dim = useRef(new Animated.Value(1)).current;
  const shouldDim = settings.nightDim && isNight(now);

  useEffect(() => {
    Animated.timing(dim, {
      toValue: shouldDim ? NIGHT_OPACITY : 1,
      duration: duration.slow,
      useNativeDriver: true,
    }).start();
  }, [dim, shouldDim]);

  /* -- Tap-to-reveal chrome ------------------------------------------------ */

  const chrome = useRef(new Animated.Value(0)).current;
  const [armed, setArmed] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reveal = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setArmed(true);
    Haptics.selectionAsync().catch(() => {});

    Animated.timing(chrome, {
      toValue: 1,
      duration: duration.fast,
      useNativeDriver: true,
    }).start();

    hideTimer.current = setTimeout(() => {
      Animated.timing(chrome, {
        toValue: 0,
        duration: duration.base,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setArmed(false);
      });
    }, CHROME_TIMEOUT_MS);
  }, [chrome]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  /* -- Layout -------------------------------------------------------------- */

  // One number drives every face's typography, derived from the shorter axis so
  // the face fits in portrait and landscape alike.
  const faceSize = Math.min(width * 0.28, height * 0.3);

  if (!ready) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <StatusBar hidden style="light" />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: dim }]}>
        <Backdrop backdrop={settings.backdrop} accent={accent} />
      </Animated.View>

      {/* Sits below the chrome so a tap anywhere else reveals it. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={reveal}
        accessibilityRole="button"
        accessibilityLabel="Show clock controls"
      />

      <View
        pointerEvents="box-none"
        style={[
          styles.content,
          {
            paddingTop: insets.top + space.md,
            paddingBottom: insets.bottom + space.lg,
            paddingHorizontal: space.xl,
          },
        ]}
      >
        <Animated.View
          pointerEvents={armed ? 'auto' : 'none'}
          style={[styles.header, { opacity: chrome }]}
        >
          <Pressable
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [
              styles.controlButton,
              pressed && styles.controlButtonPressed,
            ]}
            hitSlop={space.md}
            accessibilityRole="button"
            accessibilityLabel="Clock settings"
          >
            <SlidersGlyph size={20} color={label.primary} />
          </Pressable>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[styles.center, { opacity: dim }]}
        >
          <BurnInGuard enabled={settings.burnInGuard} style={styles.faceBlock}>
            <ClockFace
              now={now}
              settings={settings}
              accent={accent}
              size={faceSize}
            />
            {settings.showDate && (
              <Text style={styles.date} allowFontScaling={false}>
                {longDate(now)}
              </Text>
            )}
          </BurnInGuard>
        </Animated.View>

        {settings.showUsage && (
          <Animated.View pointerEvents="none" style={{ opacity: dim }}>
            <UsageBar result={usage.result} accentColor={accent.color} />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.kiosk },
  content: { flex: 1, flexDirection: 'column' },
  header: { flexDirection: 'row', justifyContent: 'flex-end' },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.glass,
    borderWidth: hairline,
    borderColor: surface.glassBorder,
  },
  controlButtonPressed: { opacity: 0.55 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  faceBlock: { alignItems: 'center' },
  date: {
    ...type.callout,
    color: label.secondary,
    marginTop: space.lg,
  },
});
