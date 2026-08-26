import 'server-only';

/**
 * Tiny in-memory TTL cache for live connector responses. Module-level state,
 * so it survives across requests within one process and resets on restart —
 * exactly what a single-process, no-DB dashboard needs (see PROJECT.md).
 * Keyed by widget id + settings so two instances of the same widget with
 * different settings (e.g. two `weather.current` widgets for two cities)
 * never collide.
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export function cacheKey(widgetId: string, settings: unknown): string {
  return `${widgetId}|${JSON.stringify(settings)}`;
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlSeconds: number): void {
  if (ttlSeconds <= 0) return;
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}
