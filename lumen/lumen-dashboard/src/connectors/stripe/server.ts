/**
 * Stripe connector — balance, revenue and recent payments.
 * Live data uses the Stripe REST API (https://api.stripe.com/v1) with a secret key;
 * without STRIPE_SECRET_KEY every handler falls back to deterministic mock data.
 */
import type { ConnectorServer, WidgetSettings } from '@/lib/types';
import { hasEnv } from '@/lib/env';
import { debugFetch, withFallback } from '@/lib/fallback';
import { cached, cacheKey } from '@/lib/cache';
import { seeded, intBetween } from '@/lib/mock';

const ENV = ['STRIPE_SECRET_KEY'];
const API = 'https://api.stripe.com/v1';
const DAY_MS = 86400000;
const CACHE_TTL_SECONDS = 60;

/* ---------- data shapes (mock and live return exactly these) ---------- */

export interface StripeCurrencyBalance {
  currency: string;
  available: number; // minor units
  pending: number; // minor units
}
export interface StripeBalanceData {
  currency: string;
  available: number;
  pending: number;
  others: StripeCurrencyBalance[];
  livemode: boolean;
  updatedAt: string;
}

export interface StripeRevenuePoint {
  date: string; // YYYY-MM-DD
  amount: number; // minor units
}
export interface StripeRevenueData {
  currency: string;
  days: number;
  total: number;
  previousTotal: number;
  changePct: number | null;
  count: number;
  series: StripeRevenuePoint[];
}

export interface StripePayment {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  created: string; // ISO
}
export interface StripePaymentsData {
  charges: StripePayment[];
}

/* ---------- tiny json / settings helpers ---------- */

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asNum(v: unknown, d = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
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
/** Local YYYY-MM-DD, used both for day buckets and for the mock seed. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function today(): string {
  return dayKey(new Date());
}

/* ---------- live API ---------- */

async function stripeGet(path: string): Promise<unknown> {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  const res = await debugFetch('stripe', `${API}/${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Stripe ${res.status} on /${path}`);
  return (await res.json()) as unknown;
}

/** GET /v1/balance -> available[] / pending[] amounts per currency. */
async function liveBalance(settings: WidgetSettings): Promise<StripeBalanceData> {
  const wanted = setStr(settings.currency, 'usd').toLowerCase();
  const body = await stripeGet('balance');
  const totals = new Map<string, StripeCurrencyBalance>();
  const take = (list: unknown, field: 'available' | 'pending') => {
    for (const entry of asArr(list)) {
      if (!isRec(entry)) continue;
      const currency = asStr(entry.currency, 'usd').toLowerCase();
      const row = totals.get(currency) ?? { currency, available: 0, pending: 0 };
      row[field] += asNum(entry.amount);
      totals.set(currency, row);
    }
  };
  if (isRec(body)) {
    take(body.available, 'available');
    take(body.pending, 'pending');
  }
  const selected = totals.get(wanted) ?? { currency: wanted, available: 0, pending: 0 };
  const others = [...totals.values()]
    .filter((e) => e.currency !== wanted && (e.available !== 0 || e.pending !== 0))
    .sort((a, b) => b.available - a.available);
  return {
    currency: selected.currency,
    available: selected.available,
    pending: selected.pending,
    others,
    livemode: isRec(body) && body.livemode === true,
    updatedAt: new Date().toISOString(),
  };
}

interface ParsedCharge {
  amount: number;
  currency: string;
  created: number; // unix seconds
}

/** Successful, settled charges only — that is what "gross volume" counts. */
function parsePaidCharges(body: unknown): ParsedCharge[] {
  const out: ParsedCharge[] = [];
  if (!isRec(body)) return out;
  for (const item of asArr(body.data)) {
    if (!isRec(item)) continue;
    if (item.paid !== true || asStr(item.status) !== 'succeeded') continue;
    out.push({
      amount: asNum(item.amount),
      currency: asStr(item.currency, 'chf').toLowerCase(),
      created: asNum(item.created),
    });
  }
  return out;
}

/** GET /v1/charges for the window and the one before it, then bucket by day. */
async function liveRevenue(settings: WidgetSettings): Promise<StripeRevenueData> {
  const days = setNum(settings.days, 30, 1, 90);
  const nowSec = Math.floor(Date.now() / 1000);
  const windowSec = days * 86400;
  const start = nowSec - windowSec;
  const prevStart = start - windowSec;

  const [currentBody, previousBody] = await Promise.all([
    stripeGet(`charges?limit=100&created[gte]=${start}`),
    stripeGet(`charges?limit=100&created[gte]=${prevStart}&created[lt]=${start}`),
  ]);

  const current = parsePaidCharges(currentBody);
  const previous = parsePaidCharges(previousBody);

  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) buckets.set(dayKey(new Date(Date.now() - i * DAY_MS)), 0);
  for (const c of current) {
    const key = dayKey(new Date(c.created * 1000));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + c.amount);
  }

  const total = current.reduce((sum, c) => sum + c.amount, 0);
  const previousTotal = previous.reduce((sum, c) => sum + c.amount, 0);
  return {
    currency: current.length > 0 ? current[0].currency : 'chf',
    days,
    total,
    previousTotal,
    changePct: previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null,
    count: current.length,
    series: [...buckets.entries()].map(([date, amount]) => ({ date, amount })),
  };
}

/** GET /v1/charges?limit=N -> the most recent charges, newest first. */
async function livePayments(settings: WidgetSettings): Promise<StripePaymentsData> {
  const limit = setNum(settings.limit, 8, 1, 25);
  const body = await stripeGet(`charges?limit=${limit}`);
  const charges: StripePayment[] = [];
  if (isRec(body)) {
    for (const item of asArr(body.data)) {
      if (!isRec(item)) continue;
      const billing = isRec(item.billing_details) ? item.billing_details : {};
      const description = asStr(item.description) || null;
      const name =
        asStr(billing.name) ||
        asStr(billing.email) ||
        asStr(item.receipt_email) ||
        (typeof item.customer === 'string' ? item.customer : '') ||
        description ||
        'Payment';
      const rawStatus = asStr(item.status);
      const status: StripePayment['status'] =
        rawStatus === 'succeeded' || rawStatus === 'pending' || rawStatus === 'failed' ? rawStatus : 'pending';
      charges.push({
        id: asStr(item.id, `ch_${charges.length}`),
        name,
        description: description === name ? null : description,
        amount: asNum(item.amount),
        currency: asStr(item.currency, 'chf').toLowerCase(),
        status,
        created: new Date(asNum(item.created) * 1000).toISOString(),
      });
    }
  }
  return { charges };
}

/* ---------- mock (deterministic per widget id + day) ---------- */

function mockBalance(settings: WidgetSettings): StripeBalanceData {
  const wanted = setStr(settings.currency, 'usd').toLowerCase();
  const rnd = seeded(`stripe.balance|${today()}`);
  const entries: StripeCurrencyBalance[] = [
    { currency: 'chf', available: intBetween(rnd, 184000, 521000), pending: intBetween(rnd, 21000, 96000) },
    { currency: 'eur', available: intBetween(rnd, 12000, 68000), pending: intBetween(rnd, 0, 24000) },
    { currency: 'usd', available: intBetween(rnd, 4000, 26000), pending: intBetween(rnd, 0, 8000) },
    { currency: 'gbp', available: intBetween(rnd, 0, 17000), pending: 0 },
  ];
  const selected = entries.find((e) => e.currency === wanted) ?? { currency: wanted, available: 0, pending: 0 };
  return {
    currency: selected.currency,
    available: selected.available,
    pending: selected.pending,
    others: entries
      .filter((e) => e.currency !== selected.currency && (e.available !== 0 || e.pending !== 0))
      .sort((a, b) => b.available - a.available),
    livemode: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Six months of daily gross volume for a weekend-heavy photography business,
 * generated once so that changing `days` slides a window over a stable history.
 */
function mockHistory(): { amount: number; count: number }[] {
  const rnd = seeded(`stripe.revenue|${today()}`);
  const span = 180;
  const out: { amount: number; count: number }[] = [];
  for (let i = 0; i < span; i++) {
    const d = new Date(Date.now() - (span - 1 - i) * DAY_MS);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6;
    let amount = 0;
    let count = 0;
    if (rnd() < (weekend ? 0.6 : 0.29)) {
      const bookings = rnd() < 0.22 ? 2 : 1;
      for (let b = 0; b < bookings; b++) {
        amount += intBetween(rnd, 9000, 68000); // CHF 90.00 – 680.00
        count += 1;
      }
    }
    out.push({ amount, count });
  }
  return out;
}

function mockRevenue(settings: WidgetSettings): StripeRevenueData {
  const days = setNum(settings.days, 30, 1, 90);
  const history = mockHistory();
  const currentSlice = history.slice(history.length - days);
  const previousSlice = history.slice(Math.max(0, history.length - days * 2), history.length - days);
  const total = currentSlice.reduce((s, p) => s + p.amount, 0);
  const previousTotal = previousSlice.reduce((s, p) => s + p.amount, 0);
  return {
    currency: 'chf',
    days,
    total,
    previousTotal,
    changePct: previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null,
    count: currentSlice.reduce((s, p) => s + p.count, 0),
    series: currentSlice.map((p, i) => ({
      date: dayKey(new Date(Date.now() - (days - 1 - i) * DAY_MS)),
      amount: p.amount,
    })),
  };
}

const MOCK_CLIENTS: { name: string; description: string; currency: string; min: number; max: number }[] = [
  { name: 'Familie Brunner', description: 'Taufe-Shooting · Telli', currency: 'chf', min: 28000, max: 42000 },
  { name: 'Kantonsschule Aarau', description: 'Maturaball Fotostand', currency: 'chf', min: 45000, max: 68000 },
  { name: 'Nadia Keller', description: 'Portraitshooting Altstadt', currency: 'chf', min: 14000, max: 22000 },
  { name: 'FC Aarau Junioren', description: 'Teamfotos Saison 26/27', currency: 'chf', min: 32000, max: 52000 },
  { name: 'Velo Huber AG', description: 'Produktfotos Webshop', currency: 'chf', min: 24000, max: 38000 },
  { name: 'Weingut Rheinblick', description: 'Sortimentsbilder', currency: 'eur', min: 18000, max: 30000 },
  { name: 'Lea Frei', description: 'Bewerbungsfotos', currency: 'chf', min: 9000, max: 14000 },
  { name: 'Café Kirchplatz', description: 'Menükarte Neuauflage', currency: 'chf', min: 12000, max: 19000 },
  { name: 'Hochzeit Meier–Schnyder', description: 'Anzahlung Reportage', currency: 'chf', min: 50000, max: 75000 },
  { name: 'Simon Roth', description: 'Bildlizenz Vereinsheft', currency: 'chf', min: 4000, max: 9000 },
  { name: 'Atelier Nordlicht', description: 'Assistenz Studiotag', currency: 'chf', min: 15000, max: 25000 },
  { name: 'Familie Bhend', description: 'Familienshooting Herbst', currency: 'chf', min: 26000, max: 40000 },
];

function mockPayments(settings: WidgetSettings): StripePaymentsData {
  const limit = setNum(settings.limit, 8, 1, 25);
  const rnd = seeded(`stripe.payments|${today()}`);
  // Walk a shuffled client list so the same name never lands twice in a row.
  const order = MOCK_CLIENTS.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  const charges: StripePayment[] = [];
  let hoursAgo = 0;
  for (let i = 0; i < 25; i++) {
    const client = order[i % order.length];
    hoursAgo += intBetween(rnd, 3, 41);
    const roll = rnd();
    const status: StripePayment['status'] = i === 0 && roll < 0.5 ? 'pending' : roll < 0.08 ? 'failed' : 'succeeded';
    charges.push({
      id: `ch_3P${String(90210 + i * 7)}mock`,
      name: client.name,
      description: client.description,
      amount: intBetween(rnd, client.min, client.max),
      currency: client.currency,
      status,
      created: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
    });
  }
  return { charges: charges.slice(0, limit) };
}

/* ---------- connector ---------- */

const connector: ConnectorServer = {
  meta: {
    id: 'stripe',
    name: 'Stripe',
    description: 'Balance, gross volume and recent payments from your Stripe account.',
    icon: '💳',
    accent: '#635bff',
    envKeys: ENV,
    docsUrl: 'https://stripe.com/docs/api',
  },
  isLive: () => hasEnv(ENV),
  handlers: {
    'stripe.balance': (s) =>
      withFallback(
        hasEnv(ENV),
        () => cached(cacheKey('stripe.balance', s), CACHE_TTL_SECONDS, () => liveBalance(s)),
        () => mockBalance(s),
        'stripe.balance',
      ),
    'stripe.revenue': (s) =>
      withFallback(
        hasEnv(ENV),
        () => cached(cacheKey('stripe.revenue', s), CACHE_TTL_SECONDS, () => liveRevenue(s)),
        () => mockRevenue(s),
        'stripe.revenue',
      ),
    'stripe.payments': (s) =>
      withFallback(
        hasEnv(ENV),
        () => cached(cacheKey('stripe.payments', s), CACHE_TTL_SECONDS, () => livePayments(s)),
        () => mockPayments(s),
        'stripe.payments',
      ),
  },
};

export default connector;
