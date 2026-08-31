import 'server-only';
import { debugLog } from './fallback';

interface Entry {
  value: unknown;
  expiresAt: number;
}

/**
 * Module-level, so it survives across requests within one server process but
 * resets on restart/redeploy — fine for a local-first, single-process app.
 */
const store = new Map<string, Entry>();

/**
 * In-memory TTL cache for connector live calls, keyed by widget id + settings.
 * A miss (including a rejected `compute()`) is never stored, so a failed live
 * call is retried on the very next request instead of sticking around for the
 * TTL — caching must not hide the failures Phase 0 made visible.
 */
export async function cached<T>(widgetId: string, settings: unknown, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const key = `${widgetId}|${JSON.stringify(settings)}`;
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    debugLog(widgetId, 'cache hit, upstream call skipped');
    return hit.value as T;
  }
  const value = await compute();
  store.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  return value;
}
