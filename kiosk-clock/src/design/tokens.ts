import { StyleSheet, type TextStyle } from 'react-native';

/** 4-point spacing grid. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const duration = {
  fast: 180,
  base: 300,
  slow: 700,
} as const;

export const hairline = StyleSheet.hairlineWidth;

/**
 * Numerals must not reflow as digits change, so every glyph gets the same
 * advance width. Large type also gets tighter tracking, the way SF Pro Display
 * tightens as it scales up.
 */
export const numerals: TextStyle = {
  fontVariant: ['tabular-nums'],
  includeFontPadding: false,
};

export function tracking(size: number): number {
  return size >= 64 ? -size * 0.035 : -size * 0.015;
}

/** iOS text styles used by the settings surfaces. */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.37 },
  title: { fontSize: 20, fontWeight: '600', letterSpacing: -0.45 },
  body: { fontSize: 17, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontSize: 16, fontWeight: '400', letterSpacing: -0.32 },
  footnote: { fontSize: 13, fontWeight: '400', letterSpacing: -0.08 },
  caption: { fontSize: 12, fontWeight: '500', letterSpacing: 0 },
  sectionHeader: { fontSize: 13, fontWeight: '400', letterSpacing: 0.5 },
} satisfies Record<string, TextStyle>;
