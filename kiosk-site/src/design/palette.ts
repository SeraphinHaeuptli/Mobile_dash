/**
 * The app's colour system, ported verbatim from `kiosk-clock/src/design/palette.ts`.
 *
 * The site and the app must not drift: a marketing page that shows a slightly
 * different blue than the product is worse than one that shows no colour at all.
 * Values mirror Apple's dark-mode system palette.
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

/** `#RRGGBB` to an `[r, g, b]` triple, for canvas work that interpolates hues. */
export function toRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}
