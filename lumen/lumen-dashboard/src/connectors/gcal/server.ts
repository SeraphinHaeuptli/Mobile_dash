/**
 * Google Calendar connector — upcoming agenda and a next-event countdown.
 * Live data: GET https://www.googleapis.com/calendar/v3/calendars/<id>/events
 * with an OAuth bearer token in GOOGLE_CALENDAR_TOKEN.
 */
import type { ConnectorServer, WidgetSettings } from '@/lib/types';
import { hasEnv } from '@/lib/env';
import { debugFetch, withFallback } from '@/lib/fallback';
import { cacheKey } from '@/lib/cache';
import { mockCalendar } from './mock';

const ENV = ['GOOGLE_CALENDAR_TOKEN'];
const API = 'https://www.googleapis.com/calendar/v3';
const CACHE_TTL_SECONDS = 60;

/* ---------- data shapes (mock and live return exactly these) ---------- */

export interface CalEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location: string | null;
}
export interface AgendaData {
  calendarId: string;
  days: number;
  events: CalEvent[];
}
export interface NextEventData {
  calendarId: string;
  event: CalEvent | null;
}

/* ---------- helpers ---------- */

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function asStr(v: unknown, d = ''): string {
  return typeof v === 'string' ? v : d;
}
function setNum(v: unknown, d: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
}
function setStr(v: unknown, d: string): string {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : d;
}
/** Local midnight `offset` days from now. */
function midnight(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/* ---------- live API ---------- */

/** A Google event edge is either { dateTime } (timed) or { date } (all-day). */
function edge(v: unknown): { iso: string; allDay: boolean } | null {
  if (!isRec(v)) return null;
  const dateTime = asStr(v.dateTime);
  if (dateTime) return { iso: new Date(dateTime).toISOString(), allDay: false };
  const date = asStr(v.date);
  if (date) {
    const [y, m, d] = date.split('-').map((p) => Number(p));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return { iso: new Date(y, m - 1, d, 0, 0, 0, 0).toISOString(), allDay: true };
  }
  return null;
}

async function fetchEvents(calendarId: string, timeMin: Date, timeMax: Date, maxResults: number): Promise<CalEvent[]> {
  const token = process.env.GOOGLE_CALENDAR_TOKEN ?? '';
  const url =
    `${API}/calendars/${encodeURIComponent(calendarId)}/events` +
    `?timeMin=${encodeURIComponent(timeMin.toISOString())}` +
    `&timeMax=${encodeURIComponent(timeMax.toISOString())}` +
    `&singleEvents=true&orderBy=startTime&maxResults=${maxResults}`;
  const res = await debugFetch('gcal', url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Google Calendar ${res.status}`);
  const body: unknown = await res.json();
  const items = isRec(body) && Array.isArray(body.items) ? body.items : [];
  const events: CalEvent[] = [];
  for (const item of items) {
    if (!isRec(item)) continue;
    if (asStr(item.status) === 'cancelled') continue;
    const start = edge(item.start);
    const end = edge(item.end);
    if (!start) continue;
    events.push({
      id: asStr(item.id, `evt-${events.length}`),
      title: asStr(item.summary, '(no title)'),
      start: start.iso,
      end: end ? end.iso : start.iso,
      allDay: start.allDay,
      location: asStr(item.location) || null,
    });
  }
  return events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/* ---------- handlers ---------- */

function upcoming(events: CalEvent[]): CalEvent[] {
  const now = Date.now();
  return events.filter((e) => new Date(e.end).getTime() > now);
}

async function liveAgenda(settings: WidgetSettings): Promise<AgendaData> {
  const calendarId = setStr(settings.calendarId, 'primary');
  const days = setNum(settings.days, 3, 1, 30);
  const limit = setNum(settings.limit, 10, 1, 50);
  const events = await fetchEvents(calendarId, new Date(), midnight(days), Math.min(50, limit * 3));
  return { calendarId, days, events: upcoming(events).slice(0, limit) };
}

function mockAgenda(settings: WidgetSettings): AgendaData {
  const calendarId = setStr(settings.calendarId, 'primary');
  const days = setNum(settings.days, 3, 1, 30);
  const limit = setNum(settings.limit, 10, 1, 50);
  return { calendarId, days, events: upcoming(mockCalendar(calendarId, days)).slice(0, limit) };
}

/**
 * The next event that has not started yet. Timed events win over all-day
 * markers — a countdown to "Schulfrei" is less useful than one to a shoot.
 */
function firstNotStarted(events: CalEvent[]): CalEvent | null {
  const now = Date.now();
  const pending = events.filter((e) => new Date(e.start).getTime() > now);
  return pending.find((e) => !e.allDay) ?? pending[0] ?? null;
}

async function liveNext(settings: WidgetSettings): Promise<NextEventData> {
  const calendarId = setStr(settings.calendarId, 'primary');
  const events = await fetchEvents(calendarId, new Date(), midnight(14), 20);
  return { calendarId, event: firstNotStarted(events) };
}

function mockNext(settings: WidgetSettings): NextEventData {
  const calendarId = setStr(settings.calendarId, 'primary');
  return { calendarId, event: firstNotStarted(mockCalendar(calendarId, 14)) };
}

const connector: ConnectorServer = {
  meta: {
    id: 'gcal',
    name: 'Google Calendar',
    description: 'Upcoming events and a countdown to whatever is next.',
    icon: '📅',
    accent: '#4285f4',
    envKeys: ENV,
    docsUrl: 'https://developers.google.com/calendar/api/v3/reference/events/list',
  },
  isLive: () => hasEnv(ENV),
  handlers: {
    'gcal.agenda': (s) =>
      withFallback(hasEnv(ENV), () => liveAgenda(s), () => mockAgenda(s), 'gcal.agenda', {
        key: cacheKey('gcal.agenda', s),
        ttlSeconds: CACHE_TTL_SECONDS,
      }),
    'gcal.next': (s) =>
      withFallback(hasEnv(ENV), () => liveNext(s), () => mockNext(s), 'gcal.next', {
        key: cacheKey('gcal.next', s),
        ttlSeconds: CACHE_TTL_SECONDS,
      }),
  },
};

export default connector;
