import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FacePicker } from '@/clock/FacePicker';
import { useSettings } from '@/clock/SettingsContext';
import type { BackdropId, NumeralWeight } from '@/clock/settings';
import { useNow } from '@/core/useNow';
import { label, surface } from '@/design/palette';
import { hairline, space, type } from '@/design/tokens';
import { BlockRow, Row, ToggleRow } from '@/ui/Row';
import { Section } from '@/ui/Section';
import { Segmented } from '@/ui/Segmented';
import { Swatches } from '@/ui/Swatches';
import { FieldRow } from '@/ui/Field';
import { resolveEndpoint, useUsage } from '@/usage/useUsage';

const BACKDROPS = [
  { id: 'black', name: 'Black' },
  { id: 'gradient', name: 'Gradient' },
  { id: 'aurora', name: 'Aurora' },
] as const satisfies readonly { id: BackdropId; name: string }[];

const WEIGHTS = [
  { id: 'light', name: 'Light' },
  { id: 'regular', name: 'Regular' },
  { id: 'bold', name: 'Bold' },
] as const satisfies readonly { id: NumeralWeight; name: string }[];

const USAGE_FOOTER =
  'Point this at any endpoint returning ' +
  '{"session":{"used":0.62,"resetsAt":"<ISO date>"}}. ' +
  '"used" may be a 0–1 fraction, or a count alongside "limit". ' +
  'An optional "week" object is shown next to the session meter. ' +
  'Leave empty to display sample data.';

function sourceStatus(
  mode: 'sample' | 'live' | 'stale' | undefined,
  warning: string | undefined,
): string {
  if (mode === 'live') return 'Live';
  if (mode === 'stale') return `Unreachable — ${warning ?? 'unknown error'}`;
  return 'Sample data';
}

export default function SettingsScreen() {
  const { settings, accent, update, reset } = useSettings();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useNow('second');

  // The title bar earns a separator only once content has slid under it, the
  // way a large-title navigation bar behaves.
  const [scrolled, setScrolled] = useState(false);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrolled(event.nativeEvent.contentOffset.y > 4);
  };

  // Mirrors the kiosk's own source so the status line reflects the real result
  // of whatever endpoint is currently typed in.
  const usage = useUsage(resolveEndpoint(settings.usageEndpoint), true);

  const confirmReset = () => {
    Alert.alert('Reset all settings?', 'The clock returns to its defaults.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: reset },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <Text style={styles.title}>Clock</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.md}
          accessibilityRole="button"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={[styles.done, { color: accent.color }]}>Done</Text>
        </Pressable>
      </View>
      <View style={[styles.headerRule, scrolled && styles.headerRuleVisible]} />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Section title="Face">
          <BlockRow>
            <FacePicker
              now={now}
              settings={settings}
              accent={accent}
              onChange={(face) => update({ face })}
            />
          </BlockRow>
        </Section>

        <Section title="Style">
          <BlockRow title="Accent">
            <Swatches
              value={settings.accent}
              onChange={(next) => update({ accent: next })}
            />
          </BlockRow>
          <BlockRow title="Background">
            <Segmented
              options={BACKDROPS}
              value={settings.backdrop}
              onChange={(backdrop) => update({ backdrop })}
            />
          </BlockRow>
          <BlockRow title="Numeral weight">
            <Segmented
              options={WEIGHTS}
              value={settings.weight}
              onChange={(weight) => update({ weight })}
            />
          </BlockRow>
        </Section>

        <Section title="Display">
          <ToggleRow
            title="24-Hour Time"
            value={settings.hour12 === false}
            onValueChange={(on) => update({ hour12: !on })}
            accentColor={accent.color}
          />
          <ToggleRow
            title="Seconds"
            value={settings.showSeconds}
            onValueChange={(showSeconds) => update({ showSeconds })}
            accentColor={accent.color}
          />
          <ToggleRow
            title="Date"
            value={settings.showDate}
            onValueChange={(showDate) => update({ showDate })}
            accentColor={accent.color}
          />
          <ToggleRow
            title="Usage Counter"
            value={settings.showUsage}
            onValueChange={(showUsage) => update({ showUsage })}
            accentColor={accent.color}
          />
        </Section>

        <Section
          title="Kiosk"
          footer="Night dimming fades the display between 10 PM and 7 AM. Burn-in protection drifts the clock a few points on a slow cycle."
        >
          <ToggleRow
            title="Keep Screen On"
            value={settings.keepAwake}
            onValueChange={(keepAwake) => update({ keepAwake })}
            accentColor={accent.color}
          />
          <ToggleRow
            title="Night Dimming"
            value={settings.nightDim}
            onValueChange={(nightDim) => update({ nightDim })}
            accentColor={accent.color}
          />
          <ToggleRow
            title="Burn-In Protection"
            value={settings.burnInGuard}
            onValueChange={(burnInGuard) => update({ burnInGuard })}
            accentColor={accent.color}
          />
          <ToggleRow
            title="Landscape"
            subtitle="Lock the kiosk sideways for a dock or stand"
            value={settings.landscape}
            onValueChange={(landscape) => update({ landscape })}
            accentColor={accent.color}
          />
        </Section>

        <Section title="Claude Usage" footer={USAGE_FOOTER}>
          <FieldRow
            title="Endpoint"
            value={settings.usageEndpoint}
            placeholder="https://…"
            onChangeText={(usageEndpoint) => update({ usageEndpoint })}
          />
          <Row
            title="Source"
            right={
              <Text style={styles.status} numberOfLines={1}>
                {sourceStatus(usage.result?.mode, usage.result?.warning)}
              </Text>
            }
          />
        </Section>

        <Section>
          <Row title="Reset All Settings" destructive onPress={confirmReset} />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.base },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  headerRule: {
    height: hairline,
    backgroundColor: surface.separator,
    opacity: 0,
  },
  headerRuleVisible: { opacity: 1 },
  title: { ...type.largeTitle, color: label.primary },
  done: { ...type.body, fontWeight: '600' },
  pressed: { opacity: 0.5 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.md },
  status: {
    ...type.footnote,
    color: label.tertiary,
    flexShrink: 1,
    textAlign: 'right',
  },
});
