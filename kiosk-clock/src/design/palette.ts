/**
 * Colour system. Values mirror Apple's dark-mode system palette so the app
 * feels native next to iOS built-ins rather than approximating it.
 */

export type AccentId =
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'mint';

export interface Accent {
  id: AccentId;
  name: string;
  /** Primary tint: numerals, fills, switches. */
  color: string;
  /** Companion hue used for the second wash in the aurora backdrop. */
  companion: string;
}

export const ACCENTS: readonly Accent[] = [
  { id: 'blue', name: 'Blue', color: '#0A84FF', companion: '#5E5CE6' },
  { id: 'indigo', name: 'Indigo', color: '#5E5CE6', companion: '#BF5AF2' },
  { id: 'purple', name: 'Purple', color: '#BF5AF2', companion: '#FF375F' },
  { id: 'pink', name: 'Pink', color: '#FF375F', companion: '#FF9F0A' },
  { id: 'orange', name: 'Orange', color: '#FF9F0A', companion: '#FF375F' },
  { id: 'yellow', name: 'Yellow', color: '#FFD60A', companion: '#FF9F0A' },
  { id: 'green', name: 'Green', color: '#30D158', companion: '#40C8E0' },
  { id: 'mint', name: 'Mint', color: '#63E6E2', companion: '#0A84FF' },
];

export function accentOf(id: AccentId): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

/** Text colours, matching iOS dark-mode label roles. */
export const label = {
  primary: '#FFFFFF',
  secondary: 'rgba(235,235,245,0.60)',
  tertiary: 'rgba(235,235,245,0.30)',
  quaternary: 'rgba(235,235,245,0.18)',
} as const;

/** Backgrounds and separators, matching iOS dark-mode system greys. */
export const surface = {
  /** True black: the kiosk canvas, and what OLED panels actually switch off. */
  kiosk: '#000000',
  base: '#000000',
  grouped: '#1C1C1E',
  raised: '#2C2C2E',
  control: '#3A3A3C',
  separator: 'rgba(84,84,88,0.65)',
  /** Translucent chrome that sits over the kiosk canvas. */
  glass: 'rgba(255,255,255,0.07)',
  glassBorder: 'rgba(255,255,255,0.12)',
} as const;

/** Status colours for the usage meter. */
export const status = {
  warn: '#FF9F0A',
  critical: '#FF453A',
} as const;

/** Re-express a `#RRGGBB` accent at a given alpha, for washes and glows. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
