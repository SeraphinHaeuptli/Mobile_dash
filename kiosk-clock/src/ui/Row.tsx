import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { label, status, surface } from '@/design/palette';
import { space, type } from '@/design/tokens';

const MIN_ROW_HEIGHT = 46;

interface RowProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}

export function Row({ title, subtitle, right, onPress, destructive }: RowProps) {
  const body = (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Text
          style={[styles.title, destructive && { color: status.critical }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
}

/** A row whose accessory is a switch, tinted with the current accent. */
export function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  accentColor,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  accentColor: string;
}) {
  return (
    <Row
      title={title}
      subtitle={subtitle}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: surface.control, true: accentColor }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={surface.control}
        />
      }
    />
  );
}

/** A full-width row whose content spans the card, for pickers and swatches. */
export function BlockRow({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.block}>
      {title && <Text style={styles.blockTitle}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    gap: space.md,
  },
  labels: { flexShrink: 1, gap: 2 },
  title: { ...type.body, color: label.primary },
  subtitle: { ...type.footnote, color: label.tertiary },
  pressed: { backgroundColor: surface.raised },
  block: { paddingHorizontal: space.lg, paddingVertical: space.md },
  blockTitle: {
    ...type.footnote,
    color: label.secondary,
    marginBottom: space.sm,
  },
});
