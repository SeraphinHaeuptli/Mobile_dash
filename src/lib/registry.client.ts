'use client';
import type { WidgetModule, WidgetSettings } from './types';

import stripe from '@/connectors/stripe/widgets';
import gcal from '@/connectors/gcal/widgets';
import gmail from '@/connectors/gmail/widgets';
import github from '@/connectors/github/widgets';
import weather from '@/connectors/weather/widgets';
import rss from '@/connectors/rss/widgets';
import system from '@/connectors/system/widgets';

/** Every widget available in the library. Add new ones here. */
export const WIDGETS: WidgetModule[] = [...stripe, ...gcal, ...gmail, ...github, ...weather, ...rss, ...system];

export const widgetById = (id: string) => WIDGETS.find((w) => w.def.id === id);

/** Settings object filled in from a widget's declared defaults. */
export function defaultSettings(widgetId: string): WidgetSettings {
  const w = widgetById(widgetId);
  const out: WidgetSettings = {};
  for (const f of w?.def.settings ?? []) if (f.default !== undefined) out[f.key] = f.default;
  return out;
}
