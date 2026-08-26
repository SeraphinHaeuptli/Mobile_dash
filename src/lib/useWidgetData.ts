'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WidgetResponse, WidgetSettings } from './types';

export function useWidgetData(widgetId: string, settings: WidgetSettings, refreshSeconds?: number) {
  const [res, setRes] = useState<WidgetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(settings);
  const keyRef = useRef(key);
  keyRef.current = key;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/widget/${encodeURIComponent(widgetId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: keyRef.current,
        cache: 'no-store',
      });
      setRes((await r.json()) as WidgetResponse);
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : 'request failed', mode: 'mock', fetchedAt: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, [widgetId]);

  useEffect(() => { void load(); }, [load, key]);

  useEffect(() => {
    if (!refreshSeconds) return;
    const t = setInterval(() => { void load(); }, refreshSeconds * 1000);
    return () => clearInterval(t);
  }, [load, refreshSeconds]);

  return { res, loading, reload: load };
}
