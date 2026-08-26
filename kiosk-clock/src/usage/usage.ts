import { clamp01 } from '@/core/format';
import { status } from '@/design/palette';

/**
 * Claude subscription limits run on a rolling five-hour session window, with a
 * longer weekly allowance on top. Both are modelled the same way: a fraction
 * consumed, and the instant the window rolls over.
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
  /** Absent when the source reports no weekly allowance. */
  week: UsageWindow | null;
  fetchedAt: number;
}

/**
 * Where the numbers came from. 'stale' is deliberately distinct from 'sample':
 * a configured source that failed must never be mistaken for a working one.
 */
export type UsageMode = 'sample' | 'live' | 'stale';

export interface UsageResult {
  snapshot: UsageSnapshot;
  mode: UsageMode;
  /** Why a live fetch failed. Present only when mode is 'stale'. */
  warning?: string;
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
 * Below the warning threshold the meter stays on the user's accent so it reads
 * as part of the clock; past it, it takes over with a status colour.
 */
export function levelColor(level: UsageLevel, accentColor: string): string {
  if (level === 'critical') return status.critical;
  if (level === 'warn') return status.warn;
  return accentColor;
}

export function timeUntilReset(window: UsageWindow, now: number): number {
  return Math.max(0, window.resetsAt - now);
}
