import 'server-only';
import type { ConnectorServer, HandlerResult, WidgetSettings } from './types';

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

export async function runWidget(widgetId: string, settings: WidgetSettings): Promise<HandlerResult> {
  const found = resolveWidget(widgetId);
  if (!found) throw new Error(`Unknown widget: ${widgetId}`);
  return found.handler(settings);
}
