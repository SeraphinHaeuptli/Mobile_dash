import type { AccentId } from '@/design/palette';

/** The subset of `ClockSettings` the web demo exposes. */
export type FaceId = 'digital' | 'stack' | 'analog' | 'words';
export type BackdropId = 'black' | 'gradient' | 'aurora';
export type NumeralWeight = 'light' | 'regular' | 'bold';

export interface DemoSettings {
  face: FaceId;
  accent: AccentId;
  backdrop: BackdropId;
  weight: NumeralWeight;
  hour12: boolean;
  showSeconds: boolean;
  showDate: boolean;
  showUsage: boolean;
}

/**
 * Seconds are on where the app defaults them off: a still screenshot of a clock
 * is indistinguishable from a broken one, and the moving seconds hand is what
 * tells a visitor this demo is live.
 */
export const DEMO_DEFAULTS: DemoSettings = {
  face: 'digital',
  accent: 'blue',
  backdrop: 'aurora',
  weight: 'light',
  hour12: false,
  showSeconds: true,
  showDate: true,
  showUsage: true,
};

export const FACES: readonly { id: FaceId; name: string; note: string }[] = [
  { id: 'digital', name: 'Digital', note: 'HH:MM, tint on the digits' },
  { id: 'stack', name: 'Stack', note: 'Hours over minutes, room-scale' },
  { id: 'analog', name: 'Analog', note: 'A minimal dial' },
  { id: 'words', name: 'Words', note: '“It is twenty-five past three”' },
];

export const BACKDROPS: readonly { id: BackdropId; name: string }[] = [
  { id: 'black', name: 'Black' },
  { id: 'gradient', name: 'Gradient' },
  { id: 'aurora', name: 'Aurora' },
];

export const WEIGHTS: readonly { id: NumeralWeight; name: string }[] = [
  { id: 'light', name: 'Light' },
  { id: 'regular', name: 'Regular' },
  { id: 'bold', name: 'Bold' },
];

/** Font weights for the numerals, per the app's three-step weight control. */
export const NUMERAL_WEIGHT: Record<NumeralWeight, number> = {
  light: 200,
  regular: 400,
  bold: 700,
};
