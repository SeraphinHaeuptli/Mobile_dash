import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DashboardConfig } from './types';

const FILE = path.join(process.cwd(), 'data', 'layout.json');

export const DEFAULT_CONFIG: DashboardConfig = {
  version: 1,
  theme: 'dark',
  accent: '#6ea8fe',
  columns: 12,
  items: [
    { i: 'w1', widgetId: 'gcal.next',        x: 0, y: 0, w: 4, h: 4, settings: { calendarId: 'primary' } },
    { i: 'w2', widgetId: 'weather.current',  x: 4, y: 0, w: 4, h: 4, settings: { latitude: 47.3925, longitude: 8.0442, label: 'Aarau', units: 'celsius' } },
    { i: 'w3', widgetId: 'stripe.balance',   x: 8, y: 0, w: 4, h: 4, settings: { currency: 'chf' } },
    { i: 'w4', widgetId: 'gcal.agenda',      x: 0, y: 4, w: 4, h: 6, settings: { calendarId: 'primary', days: 3, limit: 10 } },
    { i: 'w5', widgetId: 'github.activity',  x: 4, y: 4, w: 4, h: 6, settings: { username: 'octocat', limit: 8 } },
    { i: 'w6', widgetId: 'system.overview',  x: 8, y: 4, w: 4, h: 6, settings: { showHost: true } },
    { i: 'w7', widgetId: 'gmail.inbox',      x: 0, y: 10, w: 4, h: 6, settings: { query: 'is:unread in:inbox', limit: 6 } },
    { i: 'w8', widgetId: 'rss.feed',         x: 4, y: 10, w: 4, h: 6, settings: { url: 'https://hnrss.org/frontpage', limit: 8, showSnippet: false } },
    { i: 'w9', widgetId: 'system.gpu',       x: 8, y: 10, w: 4, h: 6, settings: {} },
  ],
};

export async function readConfig(): Promise<DashboardConfig> {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DashboardConfig>;
    if (!Array.isArray(parsed.items)) throw new Error('bad config');
    return { ...DEFAULT_CONFIG, ...parsed, items: parsed.items, version: 1 };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function writeConfig(config: DashboardConfig): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(config, null, 2), 'utf8');
}
