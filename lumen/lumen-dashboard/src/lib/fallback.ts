import 'server-only';

/**
 * Hidden field connector handlers attach to mock data when a live call
 * failed. `runWidget` (registry.server.ts) strips it back out and turns it
 * into WidgetResponse.mode = 'stale' + warning, so a broken connector never
 * silently looks like real data. Never read this field outside that path.
 */
export const FALLBACK_KEY = '_fallback';

/**
 * Runs `live()` when `isLive` is true, falling back to `mock()` on failure
 * or when no credentials are configured. On a live failure the mock result
 * carries the failure reason under FALLBACK_KEY for the caller to surface.
 */
export async function withFallback<T extends object>(
  isLive: boolean,
  live: () => Promise<T>,
  mock: () => T,
  label: string,
): Promise<T> {
  if (!isLive) return mock();
  try {
    return await live();
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    if (process.env.DEBUG_CONNECTORS === '1') {
      console.log(`[connectors] ${label} fell back to mock: ${reason}`);
    }
    return { ...mock(), [FALLBACK_KEY]: reason };
  }
}
