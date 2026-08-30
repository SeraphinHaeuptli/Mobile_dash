import 'server-only';
import type { WidgetSettings } from './types';

interface Entry {
  value: unknown;
  expiresAt: number;
}

/**
 * Process-lifetime in-memory cache for live connector calls. Deliberately not
 * persisted or shared across processes — this is a single-process app (see
 * PROJECT.md), so a Map is enough and a restart just means a cold cache.
 */
const store = new Map<string, Entry>();

/** Deterministic cache key: widget id + sorted settings, so different settings never collide. */
export function cacheKeyFor(widgetId: string, settings: WidgetSettings): string {
  const parts = Object.keys(settings)
    .sort()
    .map((k) => `${k}=${String(settings[k])}`)
    .join('&');
  return `${widgetId}|${parts}`;
}

/**
 * Runs `fn` and caches the resolved value for `ttlSeconds`, keyed by `key`.
 * Only successful results are cached — a rejected `fn()` is never stored, so
 * a failing upstream is retried on the very next call instead of being
 * remembered as broken for the rest of the TTL.
 */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await fn();
  store.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  return value;
}
