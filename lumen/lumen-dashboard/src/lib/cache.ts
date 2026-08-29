import 'server-only';
import type { WidgetSettings } from './types';

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

/** Stable cache key: widget id + sorted settings, same pattern as the connectors' mock seeds. */
export function cacheKey(widgetId: string, settings: WidgetSettings): string {
  const parts = Object.keys(settings)
    .sort()
    .map((k) => `${k}=${String(settings[k])}`)
    .join('&');
  return `${widgetId}|${parts}`;
}

/**
 * In-memory TTL cache for live connector calls. Concurrent callers for the
 * same key while nothing is cached yet share one in-flight request instead of
 * each hitting the upstream API — a failed call is never cached, so the next
 * call retries live.
 */
export async function cached<T>(key: string, ttlSeconds: number, live: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = live()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
}
