import 'server-only';
import type { ConnectorServer, Json, WidgetMode, WidgetSettings } from './types';
import { FALLBACK_KEY } from './fallback';

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
): Promise<{ data: Json; mode: WidgetMode; warning?: string }> {
  const found = resolveWidget(widgetId);
  if (!found) throw new Error(`Unknown widget: ${widgetId}`);
  const raw = await found.handler(settings);
  if (isRec(raw) && typeof raw[FALLBACK_KEY] === 'string') {
    const { [FALLBACK_KEY]: warning, ...data } = raw;
    return { data, mode: 'stale', warning: warning as string };
  }
  return { data: raw, mode: found.connector.isLive() ? 'live' : 'mock' };
}
