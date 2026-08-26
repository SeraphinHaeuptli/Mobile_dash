import 'server-only';
import type { HandlerResult, WidgetMode } from './types';

/**
 * Runs `live()` when credentials are present; on any failure (or when there
 * are no credentials at all) falls back to `mock()`. Unlike a bare try/catch,
 * a live failure is tagged 'stale' with the reason instead of looking exactly
 * like 'mock' — see PROJECT.md "Not done" / PLAN.md Phase 0.
 */
export async function withFallback<T>(
  hasCreds: boolean,
  live: () => Promise<T>,
  mock: () => T,
  label: string,
): Promise<HandlerResult<T>> {
  if (!hasCreds) return { data: mock(), mode: 'mock' };
  try {
    const data = await live();
    return { data, mode: 'live' };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    debugLog(label, `fallback to sample data (${reason})`);
    return { data: mock(), mode: 'stale', warning: `${label}: ${reason}` };
  }
}

/**
 * Wraps a payload that already carries its own partial-fallback marker (the
 * `system` connector: each reading falls back independently, so the handler
 * never throws) into the same {data, mode, warning} shape the other
 * connectors use.
 */
export function fromSample<T extends { sample: boolean }>(data: T, label: string): HandlerResult<T> {
  return data.sample
    ? { data, mode: 'stale', warning: `${label}: one or more live readings unavailable, showing sample values` }
    : { data, mode: 'live' };
}

/** DEBUG_CONNECTORS=1 -> log every outbound connector request; secrets never included. */
export function debugLog(label: string, message: string) {
  if (process.env.DEBUG_CONNECTORS === '1') {
    // eslint-disable-next-line no-console
    console.log(`[connectors] ${label}: ${message}`);
  }
}

/**
 * fetch() wrapper for connector transports: same signature and behaviour,
 * plus a DEBUG_CONNECTORS line with method, url, status and duration. Never
 * logs headers or body, so bearer tokens and API keys are never printed.
 */
export async function debugFetch(label: string, url: string, init?: RequestInit): Promise<Response> {
  const debug = process.env.DEBUG_CONNECTORS === '1';
  const method = init?.method ?? 'GET';
  const started = debug ? Date.now() : 0;
  try {
    const res = await fetch(url, init);
    if (debug) debugLog(label, `${method} ${url} -> ${res.status} (${Date.now() - started}ms)`);
    return res;
  } catch (e) {
    if (debug) {
      const reason = e instanceof Error ? e.message : String(e);
      debugLog(label, `${method} ${url} -> ${reason} (${Date.now() - started}ms)`);
    }
    throw e;
  }
}

export type { WidgetMode };
