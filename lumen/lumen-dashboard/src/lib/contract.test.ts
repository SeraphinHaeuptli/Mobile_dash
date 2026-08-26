import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SERVER_CONNECTORS } from './registry.server';
import { WIDGETS } from './registry.client';
import type { WidgetSettings } from './types';

/**
 * PLAN.md Phase 6 step 2 — the contract test.
 *
 * For every widget id, run the handler twice: once with no credentials (mock
 * path) and once with credentials plus a stubbed upstream serving a local
 * fixture (live parse path). Both must produce the same key shape, because the
 * widget component is written against exactly one shape and PROJECT.md's
 * conventions require live and mock to be interchangeable.
 *
 * Everything is local — no network, no credentials. `global.fetch` is replaced
 * outright, so a fixture miss surfaces as a loud error rather than a silent
 * real request.
 */

const CONNECTORS_DIR = path.join(import.meta.dirname, '..', 'connectors');
const fixture = (connector: string, name: string) =>
  readFileSync(path.join(CONNECTORS_DIR, connector, '__fixtures__', name), 'utf8');
const json = (connector: string, name: string) => JSON.parse(fixture(connector, name)) as unknown;

/* ---------- key-shape comparison ---------- */

/**
 * Reduce a value to its recursive key structure, discarding leaf values and
 * types. Arrays collapse to their first element's shape — mock and live will
 * never have the same number of items, and PLAN.md asks about *keys*.
 * Nullable leaves (`description: string | null`) therefore compare equal
 * whichever side happens to be null.
 */
function keyShape(v: unknown): unknown {
  if (Array.isArray(v)) return v.length ? [keyShape(v[0])] : [];
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = keyShape((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return null;
}

/* ---------- upstream stub ---------- */

/** Maps an outbound url to the fixture body the connector should parse. */
function fixtureFor(url: string): { body: string; contentType: string } {
  // Stripe
  if (url.includes('api.stripe.com/v1/balance')) return { body: fixture('stripe', 'balance.json'), contentType: 'application/json' };
  if (url.includes('api.stripe.com/v1/charges')) return { body: fixture('stripe', 'charges.json'), contentType: 'application/json' };
  // Google Calendar
  if (url.includes('googleapis.com/calendar/v3')) return { body: fixture('gcal', 'events.json'), contentType: 'application/json' };
  // Gmail — order matters, the detail path also contains "messages"
  if (url.includes('gmail.googleapis.com') && url.includes('labels/UNREAD')) return { body: fixture('gmail', 'label-unread.json'), contentType: 'application/json' };
  if (url.includes('gmail.googleapis.com') && url.includes('format=metadata')) return { body: fixture('gmail', 'message-detail.json'), contentType: 'application/json' };
  if (url.includes('gmail.googleapis.com') && url.includes('/messages')) return { body: fixture('gmail', 'messages-list.json'), contentType: 'application/json' };
  // GitHub
  if (url.includes('api.github.com/graphql')) return { body: fixture('github', 'contributions.json'), contentType: 'application/json' };
  if (url.includes('api.github.com') && url.includes('/events')) return { body: fixture('github', 'events.json'), contentType: 'application/json' };
  if (url.includes('api.github.com') && url.includes('/repos')) return { body: fixture('github', 'repos.json'), contentType: 'application/json' };
  // Open-Meteo — one endpoint, distinguished by the requested blocks
  if (url.includes('api.open-meteo.com') && url.includes('daily=')) return { body: fixture('weather', 'forecast.json'), contentType: 'application/json' };
  if (url.includes('api.open-meteo.com')) return { body: fixture('weather', 'current.json'), contentType: 'application/json' };
  // RSS — see RSS_FIXTURE_URL for why this is an IP literal
  if (url.includes('203.0.113.10')) return { body: fixture('rss', 'feed.xml'), contentType: 'application/rss+xml' };
  throw new Error(`No fixture registered for outbound url: ${url}`);
}

const CREDENTIAL_ENV = ['STRIPE_SECRET_KEY', 'GOOGLE_CALENDAR_TOKEN', 'GMAIL_TOKEN', 'GITHUB_TOKEN'] as const;

let savedEnv: Record<string, string | undefined> = {};
let savedFetch: typeof globalThis.fetch;

function stubUpstream() {
  savedFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const { body, contentType } = fixtureFor(url);
    return new Response(body, { status: 200, headers: { 'Content-Type': contentType } });
  }) as typeof globalThis.fetch;
}

beforeEach(() => {
  savedEnv = {};
  for (const k of CREDENTIAL_ENV) savedEnv[k] = process.env[k];
});

afterEach(() => {
  for (const k of CREDENTIAL_ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k]!;
  }
  if (savedFetch) globalThis.fetch = savedFetch;
  vi.restoreAllMocks();
});

/* ---------- per-widget settings ---------- */

/**
 * Settings are chosen so both paths return a NON-EMPTY collection — an empty
 * array collapses to `[]` in keyShape and would make the comparison vacuous.
 * Each entry also gets a unique marker so the Phase 1 response cache (keyed by
 * widget id + settings) cannot serve one case's result to another.
 */
const SETTINGS: Record<string, WidgetSettings> = {
  'stripe.balance': { currency: 'chf', _t: 'contract' },
  'stripe.revenue': { days: 30, _t: 'contract' },
  'stripe.payments': { limit: 5, _t: 'contract' },
  'gcal.agenda': { calendarId: 'primary', days: 30, limit: 10, _t: 'contract' },
  'gcal.next': { calendarId: 'primary', _t: 'contract' },
  'gmail.inbox': { query: 'is:unread in:inbox', limit: 2, _t: 'contract' },
  'github.activity': { username: 'octocat', limit: 8, _t: 'contract' },
  'github.repos': { username: 'octocat', sort: 'updated', limit: 6, _t: 'contract' },
  'github.contributions': { username: 'octocat', _t: 'contract' },
  'weather.current': { latitude: 47.3925, longitude: 8.0442, label: 'Aarau', units: 'celsius', _t: 'contract' },
  'weather.forecast': { latitude: 47.3925, longitude: 8.0442, label: 'Aarau', units: 'celsius', days: 5, _t: 'contract' },
  // An IP literal, not a hostname: rss.feed's SSRF guard resolves hostnames via
  // DNS, and this suite must run with no network at all. 203.0.113.0/24 is
  // TEST-NET-3, reserved for documentation, so it is not in any private range
  // and passes the guard on the literal branch without a lookup.
  'rss.feed': { url: 'http://203.0.113.10/frontpage', limit: 8, _t: 'contract' },
  'system.overview': { _t: 'contract' },
  'system.disks': { minSizeGb: 0, limit: 6, _t: 'contract' },
  'system.gpu': { _t: 'contract' },
  'system.processes': { limit: 6, sortBy: 'cpu', _t: 'contract' },
};

/** The system connector shells out to local tools; it has no upstream to stub. */
const SHELLS_OUT = (id: string) => id.startsWith('system.');

function handlerFor(widgetId: string) {
  const connector = SERVER_CONNECTORS.find((c) => c.meta.id === widgetId.split('.')[0]);
  if (!connector) throw new Error(`No connector for ${widgetId}`);
  const handler = connector.handlers[widgetId];
  if (!handler) throw new Error(`No handler for ${widgetId}`);
  return handler;
}

const ALL_WIDGET_IDS = WIDGETS.map((w) => w.def.id);

/* ---------- the suite ---------- */

describe('registry', () => {
  it('registers a server handler for every client widget', () => {
    for (const id of ALL_WIDGET_IDS) expect(() => handlerFor(id)).not.toThrow();
  });

  it('exposes the 16 widgets across 7 connectors PROJECT.md documents', () => {
    expect(ALL_WIDGET_IDS).toHaveLength(16);
    expect(SERVER_CONNECTORS).toHaveLength(7);
  });

  it('has a settings entry in this test for every widget', () => {
    for (const id of ALL_WIDGET_IDS) expect(SETTINGS[id], `missing SETTINGS for ${id}`).toBeDefined();
  });

  it('names every widget <connectorId>.<name>', () => {
    for (const id of ALL_WIDGET_IDS) {
      expect(id).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
      expect(SERVER_CONNECTORS.some((c) => c.meta.id === id.split('.')[0])).toBe(true);
    }
  });
});

describe.each(ALL_WIDGET_IDS)('contract: %s', (widgetId) => {
  const settings = SETTINGS[widgetId];

  it('mock path returns data with mode "mock" (or "live"/"stale" for keyless connectors)', async () => {
    for (const k of CREDENTIAL_ENV) delete process.env[k];
    if (!SHELLS_OUT(widgetId)) stubUpstream();
    const res = await handlerFor(widgetId)(settings);
    expect(res.data).toBeDefined();
    expect(['mock', 'live', 'stale']).toContain(res.mode);
  });

  it('live parse path produces the same key shape as the mock path', async () => {
    // --- mock: no credentials, and no upstream at all ---
    for (const k of CREDENTIAL_ENV) delete process.env[k];
    savedFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('mock path must not reach the network');
    }) as typeof globalThis.fetch;
    const mockRes = await handlerFor(widgetId)({ ...settings, _t: 'contract-mock' });
    globalThis.fetch = savedFetch;

    // --- live: credentials present, upstream served from the fixture ---
    for (const k of CREDENTIAL_ENV) process.env[k] = 'fixture-token';
    stubUpstream();
    const liveRes = await handlerFor(widgetId)({ ...settings, _t: 'contract-live' });

    if (SHELLS_OUT(widgetId)) {
      // No upstream to stub: whichever of live/sample this machine can produce,
      // the shape must still match the mock payload.
      expect(keyShape(liveRes.data)).toEqual(keyShape(mockRes.data));
      return;
    }

    // A fixture that failed to parse would silently fall back to the mock and
    // make the comparison vacuous, so require the live path to have succeeded.
    expect(liveRes.mode, `live path fell back: ${liveRes.warning ?? ''}`).toBe('live');
    expect(keyShape(liveRes.data)).toEqual(keyShape(mockRes.data));
  });

  it('never returns undefined or null as the payload', async () => {
    for (const k of CREDENTIAL_ENV) process.env[k] = 'fixture-token';
    if (!SHELLS_OUT(widgetId)) stubUpstream();
    const res = await handlerFor(widgetId)({ ...settings, _t: 'contract-nonnull' });
    expect(res.data).not.toBeUndefined();
    expect(res.data).not.toBeNull();
  });

  it('sets a warning whenever mode is "stale", and none when it is not', async () => {
    for (const k of CREDENTIAL_ENV) process.env[k] = 'fixture-token';
    if (!SHELLS_OUT(widgetId)) stubUpstream();
    const res = await handlerFor(widgetId)({ ...settings, _t: 'contract-warn' });
    if (res.mode === 'stale') expect(typeof res.warning).toBe('string');
    else expect(res.warning).toBeUndefined();
  });
});

/* ---------- connector metadata ---------- */

describe('connector metadata', () => {
  it.each(SERVER_CONNECTORS.map((c) => [c.meta.id, c] as const))('%s has coherent meta', (id, connector) => {
    expect(connector.meta.name).toBeTruthy();
    expect(connector.meta.description).toBeTruthy();
    expect(connector.meta.icon).toBeTruthy();
    expect(connector.meta.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(Array.isArray(connector.meta.envKeys)).toBe(true);
    // Every handler key must belong to this connector.
    for (const key of Object.keys(connector.handlers)) expect(key.split('.')[0]).toBe(id);
  });

  it('keyless connectors report live, credentialed ones follow their env keys', () => {
    for (const k of CREDENTIAL_ENV) delete process.env[k];
    for (const c of SERVER_CONNECTORS) {
      if (c.meta.envKeys.length === 0) expect(c.isLive(), `${c.meta.id}`).toBe(true);
      else expect(c.isLive(), `${c.meta.id}`).toBe(false);
    }
    for (const k of CREDENTIAL_ENV) process.env[k] = 'fixture-token';
    for (const c of SERVER_CONNECTORS) expect(c.isLive(), `${c.meta.id}`).toBe(true);
  });
});
