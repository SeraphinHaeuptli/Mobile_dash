import 'server-only';
import type { ConnectorServer, Json, WidgetSettings } from './types';

import stripe from '@/connectors/stripe/server';
import gcal from '@/connectors/gcal/server';
import gmail from '@/connectors/gmail/server';
import github from '@/connectors/github/server';
import weather from '@/connectors/weather/server';
import rss from '@/connectors/rss/server';
import system from '@/connectors/system/server';

/** Every connector's server half. Add new ones here. */
export const SERVER_CONNECTORS: ConnectorServer[] = [stripe, gcal, gmail, github, weather, rss, system];

export function resolveWidget(widgetId: string) {
  const connectorId = widgetId.split('.')[0];
  const connector = SERVER_CONNECTORS.find((c) => c.meta.id === connectorId);
  if (!connector) return null;
  const handler = connector.handlers[widgetId];
  if (!handler) return null;
  return { connector, handler };
}

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export async function runWidget(
  widgetId: string,
  settings: WidgetSettings,
): Promise<{ data: Json; mode: 'mock' | 'live' | 'stale'; warning?: string }> {
  const found = resolveWidget(widgetId);
  if (!found) throw new Error(`Unknown widget: ${widgetId}`);
  const raw = await found.handler(settings);
  // A handler that fell back after a failed live call marks it with `_fallback`
  // (see src/lib/fallback.ts); strip it out and surface it as a warning instead.
  if (isRec(raw) && typeof raw._fallback === 'string') {
    const { _fallback, ...data } = raw;
    return { data, mode: 'stale', warning: _fallback };
  }
  return { data: raw, mode: found.connector.isLive() ? 'live' : 'mock' };
}
