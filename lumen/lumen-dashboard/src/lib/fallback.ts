import 'server-only';

/** When set, log every outbound connector request (method, url, status, ms). Never logs secrets. */
const DEBUG = process.env.DEBUG_CONNECTORS === '1';

/** Call once per outbound HTTP request a connector makes. `url` must not contain a secret. */
export function logFetch(method: string, url: string, status: number | 'ERR', ms: number) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(`[connectors] ${method} ${url} ${status} ${ms}ms`);
}

/**
 * Runs `live()` when `enabled`. A thrown error there serves `mock()` instead, with
 * the failure reason attached as `_fallback` -- registry.server.ts lifts that into
 * `WidgetResponse.warning` and marks the response 'stale' rather than a silent
 * 'mock', so a broken connector says why instead of looking like a sample.
 * When `enabled` is false (no credentials configured), `mock()` is returned
 * untouched: that is the expected, unremarkable state.
 */
export async function withFallback<T extends object>(
  label: string,
  enabled: boolean,
  live: () => Promise<T>,
  mock: () => T,
): Promise<T> {
  if (!enabled) return mock();
  try {
    return await live();
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    if (DEBUG) console.log(`[connectors] ${label} fallback: ${reason}`); // eslint-disable-line no-console
    return { ...mock(), _fallback: reason } as T;
  }
}
