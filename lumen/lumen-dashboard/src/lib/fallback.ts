import 'server-only';
import { hasEnv } from './env';
import type { WidgetResult } from './types';

export interface FallbackOptions {
  /** env keys required for live mode; empty = keyless connector, always attempt live */
  envKeys: string[];
  /** label used in DEBUG_CONNECTORS logs, e.g. 'stripe.balance' */
  label: string;
}

/**
 * Every connector handler funnels through here instead of its own try/catch.
 * Missing credentials return mock data tagged 'mock'. A live call that throws
 * also falls back to mock data, but tagged 'stale' with the failure reason —
 * unlike the old per-connector copies, that failure is never swallowed silently.
 */
export async function withFallback<T>(
  live: () => Promise<T>,
  mock: () => T,
  opts: FallbackOptions,
): Promise<WidgetResult<T>> {
  const { envKeys, label } = opts;
  if (envKeys.length > 0 && !hasEnv(envKeys)) {
    return { data: mock(), mode: 'mock' };
  }
  try {
    const data = await live();
    return { data, mode: 'live' };
  } catch (e) {
    const warning = e instanceof Error ? e.message : String(e);
    if (process.env.DEBUG_CONNECTORS === '1') {
      console.error(`[connectors] ${label} fallback: ${warning}`);
    }
    return { data: mock(), mode: 'stale', warning };
  }
}
