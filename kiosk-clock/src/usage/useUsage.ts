import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useDebounced } from '@/core/useDebounced';

import { loadUsage } from './sources';
import type { UsageResult } from './usage';

const REFRESH_MS = 60_000;
const ENDPOINT_SETTLE_MS = 500;

const ENV_ENDPOINT = (
  process.env.EXPO_PUBLIC_CLAUDE_USAGE_ENDPOINT ?? ''
).trim();

/** Settings win over the build-time default, which wins over sample data. */
export function resolveEndpoint(configured: string): string {
  return configured.trim() || ENV_ENDPOINT;
}

/**
 * Keeps a usage snapshot current: on mount, once a minute, whenever the
 * endpoint changes, and on return from the background.
 */
export function useUsage(endpoint: string, enabled: boolean) {
  const [result, setResult] = useState<UsageResult | null>(null);
  const generation = useRef(0);
  const settledEndpoint = useDebounced(endpoint, ENDPOINT_SETTLE_MS);

  const refresh = useCallback(() => {
    if (!enabled) return;
    const token = ++generation.current;

    loadUsage(settledEndpoint).then((next) => {
      // Ignore responses from a superseded endpoint or unmounted screen.
      if (token === generation.current) setResult(next);
    });
  }, [settledEndpoint, enabled]);

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      return;
    }

    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      generation.current += 1;
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh, enabled]);

  return { result, refresh };
}
