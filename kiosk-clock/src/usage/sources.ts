import { clamp01 } from '@/core/format';

import {
  SESSION_WINDOW_MS,
  WEEK_WINDOW_MS,
  type UsageResult,
  type UsageSnapshot,
  type UsageWindow,
  type WindowId,
} from './usage';

const REQUEST_TIMEOUT_MS = 8_000;

/* -------------------------------------------------------------------------- */
/* Sample source                                                              */
/* -------------------------------------------------------------------------- */

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
      [0.5, 1.1],
    ),
    fetchedAt: now,
  };
}

/* -------------------------------------------------------------------------- */
/* HTTP source                                                                */
/* -------------------------------------------------------------------------- */

type Json = Record<string, unknown>;

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Accepts an epoch (ms or s), an ISO timestamp, or a relative seconds count. */
function resolveReset(raw: Json, now: number, span: number): number {
  const relative = asNumber(raw.resetsInSeconds);
  if (relative !== null) return now + relative * 1000;

  const absolute = raw.resetsAt;
  if (typeof absolute === 'string') {
    const parsed = Date.parse(absolute);
    if (Number.isFinite(parsed)) return parsed;
  }
  const numeric = asNumber(absolute);
  if (numeric !== null) {
    // Distinguish seconds from milliseconds by magnitude.
    return numeric < 1e11 ? numeric * 1000 : numeric;
  }

  return now + span;
}

/**
 * Reads one window. `used` may be a 0–1 fraction on its own, or an absolute
 * count paired with `limit`.
 */
function decodeWindow(
  raw: unknown,
  id: WindowId,
  name: string,
  now: number,
  span: number,
): UsageWindow | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const input = raw as Json;

  const used = asNumber(input.used);
  if (used === null) return null;

  const limit = asNumber(input.limit);
  const fraction = limit && limit > 0 ? used / limit : used;

  return {
    id,
    name,
    used: clamp01(fraction),
    resetsAt: resolveReset(input, now, span),
  };
}

async function fetchSnapshot(
  endpoint: string,
  now: number,
): Promise<UsageSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = (await response.json()) as Json;
    const session = decodeWindow(
      body.session,
      'session',
      'Session',
      now,
      SESSION_WINDOW_MS,
    );

    if (!session) {
      throw new Error('response has no usable "session" window');
    }

    return {
      session,
      week: decodeWindow(body.week, 'week', 'Week', now, WEEK_WINDOW_MS),
      fetchedAt: now,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/* Repository                                                                 */
/* -------------------------------------------------------------------------- */

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.name === 'AbortError' ? 'request timed out' : error.message;
  }
  return 'unknown error';
}

/**
 * The single entry point the UI uses. With no endpoint it serves sample data by
 * design; with one, a failure falls back to sample data but reports 'stale' and
 * the reason, so a broken source is visible rather than silently plausible.
 */
export async function loadUsage(
  endpoint: string,
  now: number = Date.now(),
): Promise<UsageResult> {
  if (!endpoint) {
    return { snapshot: sampleSnapshot(now), mode: 'sample' };
  }

  try {
    return { snapshot: await fetchSnapshot(endpoint, now), mode: 'live' };
  } catch (error) {
    return {
      snapshot: sampleSnapshot(now),
      mode: 'stale',
      warning: describe(error),
    };
  }
}
