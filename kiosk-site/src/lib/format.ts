/**
 * Date and duration formatting, ported from `kiosk-clock/src/core/format.ts`
 * so the demo renders exactly the strings the app does.
 */

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface TimeParts {
  hours: string;
  minutes: string;
  seconds: string;
  /** null in 24-hour mode. */
  suffix: 'AM' | 'PM' | null;
}

export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function timeParts(date: Date, hour12: boolean): TimeParts {
  const raw = date.getHours();
  const hours = hour12 ? raw % 12 || 12 : raw;

  return {
    // 12-hour clocks drop the leading zero; 24-hour clocks keep it.
    hours: hour12 ? String(hours) : pad2(hours),
    minutes: pad2(date.getMinutes()),
    seconds: pad2(date.getSeconds()),
    suffix: hour12 ? (raw < 12 ? 'AM' : 'PM') : null,
  };
}

export function longDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "2h 14m", "48m", or "under a minute" for a span given in milliseconds. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMinutes < 1) return 'under a minute';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(clamp01(fraction) * 100)}%`;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Large numerals tighten as they scale, the way SF Pro Display does.
 * Ported from the app's `tracking()` so headline and clock type match.
 */
export function tracking(size: number): number {
  return size >= 64 ? -size * 0.035 : -size * 0.015;
}
