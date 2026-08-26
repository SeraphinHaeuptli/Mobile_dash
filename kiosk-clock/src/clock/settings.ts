import { ACCENTS, type AccentId } from '@/design/palette';

export type FaceId = 'digital' | 'stack' | 'analog' | 'words';
export type BackdropId = 'black' | 'gradient' | 'aurora';
export type NumeralWeight = 'light' | 'regular' | 'bold';

export interface ClockSettings {
  face: FaceId;
  accent: AccentId;
  backdrop: BackdropId;
  weight: NumeralWeight;

  hour12: boolean;
  showSeconds: boolean;
  showDate: boolean;
  showUsage: boolean;

  /** Hold the screen on while the kiosk is in the foreground. */
  keepAwake: boolean;
  /** Fade the face down overnight instead of glaring in a dark room. */
  nightDim: boolean;
  /** Drift the face a few pixels to spare OLED panels on long runs. */
  burnInGuard: boolean;
  landscape: boolean;

  /** Optional HTTP source for live Claude usage. Empty means sample data. */
  usageEndpoint: string;
}

export const DEFAULT_SETTINGS: ClockSettings = {
  face: 'digital',
  accent: 'blue',
  backdrop: 'aurora',
  weight: 'light',

  hour12: false,
  showSeconds: false,
  showDate: true,
  showUsage: true,

  keepAwake: true,
  nightDim: true,
  burnInGuard: true,
  landscape: false,

  usageEndpoint: '',
};

const FACES: readonly FaceId[] = ['digital', 'stack', 'analog', 'words'];
const BACKDROPS: readonly BackdropId[] = ['black', 'gradient', 'aurora'];
const WEIGHTS: readonly NumeralWeight[] = ['light', 'regular', 'bold'];

function oneOf<T extends string>(
  options: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Build valid settings from anything that came out of storage. Unknown or
 * missing fields fall back to their default, so settings written by an older
 * build stay loadable after the schema changes.
 */
export function decodeSettings(raw: unknown): ClockSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
  const input = raw as Partial<Record<keyof ClockSettings, unknown>>;

  return {
    face: oneOf(FACES, input.face, DEFAULT_SETTINGS.face),
    accent: oneOf(
      ACCENTS.map((a) => a.id),
      input.accent,
      DEFAULT_SETTINGS.accent,
    ) as AccentId,
    backdrop: oneOf(BACKDROPS, input.backdrop, DEFAULT_SETTINGS.backdrop),
    weight: oneOf(WEIGHTS, input.weight, DEFAULT_SETTINGS.weight),

    hour12: bool(input.hour12, DEFAULT_SETTINGS.hour12),
    showSeconds: bool(input.showSeconds, DEFAULT_SETTINGS.showSeconds),
    showDate: bool(input.showDate, DEFAULT_SETTINGS.showDate),
    showUsage: bool(input.showUsage, DEFAULT_SETTINGS.showUsage),

    keepAwake: bool(input.keepAwake, DEFAULT_SETTINGS.keepAwake),
    nightDim: bool(input.nightDim, DEFAULT_SETTINGS.nightDim),
    burnInGuard: bool(input.burnInGuard, DEFAULT_SETTINGS.burnInGuard),
    landscape: bool(input.landscape, DEFAULT_SETTINGS.landscape),

    usageEndpoint:
      typeof input.usageEndpoint === 'string'
        ? input.usageEndpoint.trim()
        : DEFAULT_SETTINGS.usageEndpoint,
  };
}

/** Font weights for the numerals, per the three-step weight control. */
export const NUMERAL_WEIGHT: Record<NumeralWeight, '200' | '400' | '700'> = {
  light: '200',
  regular: '400',
  bold: '700',
};

const NIGHT_STARTS_AT = 22;
const NIGHT_ENDS_AT = 7;

export function isNight(date: Date): boolean {
  const hour = date.getHours();
  return hour >= NIGHT_STARTS_AT || hour < NIGHT_ENDS_AT;
}
