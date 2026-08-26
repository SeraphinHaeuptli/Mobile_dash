import { Children, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { label, surface } from '@/design/palette';
import { hairline, radius, space, type } from '@/design/tokens';

/**
 * An inset grouped list section. Separators are injected between children so
 * rows stay unaware of their position, the way UITableView handles it.
 */
export function Section({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.section}>
      {title && <Text style={styles.header}>{title.toUpperCase()}</Text>}

      <View style={styles.card}>
        {rows.map((row, index) => (
          <View key={index}>
            {index > 0 && <View style={styles.separator} />}
            {row}
          </View>
        ))}
      </View>

      {footer && <Text style={styles.footer}>{footer}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: space.xl },
  header: {
    ...type.sectionHeader,
    color: label.secondary,
    marginBottom: space.sm,
    marginLeft: space.lg,
  },
  card: {
    backgroundColor: surface.grouped,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  separator: {
    height: hairline,
    backgroundColor: surface.separator,
    marginLeft: space.lg,
  },
  footer: {
    ...type.footnote,
    color: label.tertiary,
    marginTop: space.sm,
    marginHorizontal: space.lg,
    lineHeight: 18,
  },
});
