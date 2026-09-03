/**
 * The Claude usage model, ported from `kiosk-clock/src/usage/`.
 *
 * Only the sample source comes across: the site has no endpoint to talk to, so
 * the demo meter is explicitly sample data and says so — the same grey pill the
 * app shows when nothing is configured.
 */

import { clamp01 } from '@/lib/format';
import { status } from '@/design/palette';

/**
 * Claude subscription limits run on a rolling five-hour session window, with a
 * longer weekly allowance on top.
 */
export const SESSION_WINDOW_MS = 5 * 60 * 60 * 1000;
export const WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type WindowId = 'session' | 'week';

export interface UsageWindow {
  id: WindowId;
  name: string;
  /** Share of the allowance consumed, 0–1. */
  used: number;
  /** Epoch milliseconds at which the window resets. */
  resetsAt: number;
}

export interface UsageSnapshot {
  session: UsageWindow;
  week: UsageWindow;
}

export type UsageLevel = 'calm' | 'warn' | 'critical';

const WARN_AT = 0.75;
const CRITICAL_AT = 0.9;

export function levelOf(used: number): UsageLevel {
  const value = clamp01(used);
  if (value >= CRITICAL_AT) return 'critical';
  if (value >= WARN_AT) return 'warn';
  return 'calm';
}

/**
 * Below the warning threshold the meter stays on the accent so it reads as part
 * of the clock; past it, a status colour takes over.
 */
export function levelColor(level: UsageLevel, accentColor: string): string {
  if (level === 'critical') return status.critical;
  if (level === 'warn') return status.warn;
  return accentColor;
}

export function timeUntilReset(window: UsageWindow, now: number): number {
  return Math.max(0, window.resetsAt - now);
}

/* -- Sample source --------------------------------------------------------- */

/** Deterministic 0–1 noise, so a given window always gets the same shape. */
function seed(value: number): number {
  let x = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}

function startOfWeek(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  // Shift so Monday is day 0, matching how weekly allowances are described.
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

function syntheticWindow(
  id: WindowId,
  name: string,
  anchor: number,
  span: number,
  now: number,
  intensityRange: [number, number],
): UsageWindow {
  const elapsed = (now - anchor) / span;
  const [low, high] = intensityRange;
  // Consumption tracks elapsed time, scaled by a per-window "how hard was this
  // window worked" factor, so the meter fills plausibly and resets on schedule.
  const intensity = low + seed(anchor) * (high - low);

  return { id, name, used: clamp01(elapsed * intensity), resetsAt: anchor + span };
}

/** Plausible, self-consistent usage for when no live source is configured. */
export function sampleSnapshot(now: number): UsageSnapshot {
  const sessionAnchor = Math.floor(now / SESSION_WINDOW_MS) * SESSION_WINDOW_MS;
  const weekAnchor = startOfWeek(now);

  return {
    session: syntheticWindow(
      'session',
      'Session',
      sessionAnchor,
      SESSION_WINDOW_MS,
      now,
      [0.55, 1.3],
    ),
    week: syntheticWindow(
      'week',
      'Week',
      weekAnchor,
      WEEK_WINDOW_MS,
      now,
      [0.4, 1.1],
    ),
  };
}
