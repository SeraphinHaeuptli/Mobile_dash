import 'server-only';
import type { HandlerResult } from './types';

/**
 * Every connector's live/mock split, in one place (PLAN.md Phase 0). `configured`
 * is whether credentials are present at all: false means a silent, expected
 * mock (mode 'mock'). True means the live call SHOULD have worked; if it
 * throws anyway, mock data is still returned so the widget stays useful, but
 * as mode 'stale' with the failure reason attached instead of being swallowed.
 */
export async function withFallback<T>(
  configured: boolean,
  live: () => Promise<T>,
  mock: () => T,
  label: string,
): Promise<HandlerResult & { data: T }> {
  if (!configured) return { data: mock(), mode: 'mock' };
  try {
    return { data: await live(), mode: 'live' };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { data: mock(), mode: 'stale', warning: `${label}: ${reason}` };
  }
}
