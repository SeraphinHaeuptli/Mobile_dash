import 'server-only';
import { debugLog } from './fallback';

/**
 * In-memory TTL cache for connector handler results, keyed by
 * `widgetId + JSON.stringify(settings)`. Per-process only (no persistence,
 * no cross-instance sharing) — fine for this single-process dashboard.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** TTL in seconds per connector id. Missing or 0 = never cached. */
const TTL_SECONDS: Record<string, number> = {
  weather: 600,
  rss: 300,
  github: 120,
  stripe: 60,
  gcal: 60,
  gmail: 60,
};

export function cacheTtlFor(connectorId: string): number {
  return TTL_SECONDS[connectorId] ?? 0;
}

/** Runs `fn()` and caches its resolved value for `ttlSeconds` under `key`. ttlSeconds <= 0 disables caching. */
export async function withCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  if (ttlSeconds <= 0) return fn();
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    debugLog('cache', `hit ${key}`);
    return hit.value as T;
  }
  const value = await fn();
  store.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  return value;
}
