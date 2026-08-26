import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withFallback, fromSample } from './fallback';
import { cacheKey, cacheGet, cacheSet } from './cache';

/**
 * These replace the throwaway harness written during the Phase 1 session, and
 * cover the acceptance criterion PLAN.md Phase 1 step 1 states as an HTTP test
 * ("hammer weather.current 10x, count 1 upstream request"). That HTTP version
 * still needs a machine with real network egress; this is the logic-level
 * equivalent, with the network stubbed rather than merely unreachable.
 */

let keySeq = 0;
/** A key no other test has touched, so cases cannot leak into each other. */
const freshKey = () => `test.widget|${keySeq++}|${Math.random()}`;

/* ---------- cache ---------- */

describe('cacheKey', () => {
  it('is stable for the same widget and settings', () => {
    expect(cacheKey('weather.current', { label: 'Aarau' })).toBe(cacheKey('weather.current', { label: 'Aarau' }));
  });

  it('separates two instances of one widget configured differently', () => {
    expect(cacheKey('weather.current', { label: 'Aarau' })).not.toBe(cacheKey('weather.current', { label: 'Bern' }));
  });

  it('separates different widgets with identical settings', () => {
    expect(cacheKey('weather.current', { days: 5 })).not.toBe(cacheKey('weather.forecast', { days: 5 }));
  });

  it('handles empty settings', () => {
    expect(typeof cacheKey('system.gpu', {})).toBe('string');
  });
});

describe('cacheGet / cacheSet', () => {
  it('returns undefined for a key never set', () => {
    expect(cacheGet(freshKey())).toBeUndefined();
  });

  it('round-trips a value', () => {
    const k = freshKey();
    cacheSet(k, { a: 1 }, 60);
    expect(cacheGet(k)).toEqual({ a: 1 });
  });

  it('treats a zero or negative TTL as "do not cache"', () => {
    const k1 = freshKey();
    cacheSet(k1, 'v', 0);
    expect(cacheGet(k1)).toBeUndefined();
    const k2 = freshKey();
    cacheSet(k2, 'v', -5);
    expect(cacheGet(k2)).toBeUndefined();
  });

  it('expires an entry once its TTL has passed', () => {
    vi.useFakeTimers();
    try {
      const k = freshKey();
      cacheSet(k, 'v', 60);
      vi.advanceTimersByTime(59_000);
      expect(cacheGet(k)).toBe('v');
      vi.advanceTimersByTime(2_000);
      expect(cacheGet(k)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('can cache a falsy value without it reading as a miss', () => {
    const k = freshKey();
    cacheSet(k, 0, 60);
    expect(cacheGet(k)).toBe(0);
  });
});

/* ---------- withFallback ---------- */

describe('withFallback — without cache', () => {
  it('returns mock and never calls live when there are no credentials', async () => {
    const live = vi.fn();
    const res = await withFallback(false, live, () => ({ m: true }), 'x');
    expect(res).toEqual({ data: { m: true }, mode: 'mock' });
    expect(live).not.toHaveBeenCalled();
  });

  it('returns live data as mode "live" on success', async () => {
    const res = await withFallback(true, async () => ({ real: 1 }), () => ({ real: 0 }), 'x');
    expect(res).toEqual({ data: { real: 1 }, mode: 'live' });
    expect(res.warning).toBeUndefined();
  });

  it('falls back to mock as mode "stale" with the reason on failure', async () => {
    const res = await withFallback(true, async () => { throw new Error('HTTP 401'); }, () => ({ m: true }), 'stripe.balance');
    expect(res.mode).toBe('stale');
    expect(res.data).toEqual({ m: true });
    expect(res.warning).toBe('stripe.balance: HTTP 401');
  });

  it('labels a non-Error throw rather than printing [object Object]', async () => {
    const res = await withFallback(true, async () => { throw 'plain string'; }, () => ({}), 'x');
    expect(res.warning).toBe('x: plain string');
  });

  it('never reports mode "live" when the live call threw', async () => {
    const res = await withFallback(true, async () => { throw new Error('boom'); }, () => ({}), 'x');
    expect(res.mode).not.toBe('live');
  });
});

describe('withFallback — with cache', () => {
  it('calls upstream exactly once across 10 calls (PLAN.md Phase 1 step 1)', async () => {
    const key = freshKey();
    const live = vi.fn(async () => ({ temp: 21 }));
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(await withFallback(true, live, () => ({ temp: -1 }), 'weather.current', { key, ttlSeconds: 600 }));
    }
    expect(live).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(10);
    expect(results.every((r) => r.mode === 'live')).toBe(true);
    expect(results.every((r) => r.data.temp === 21)).toBe(true);
  });

  it('reports a cache hit as "live", not a separate mode', async () => {
    const key = freshKey();
    await withFallback(true, async () => ({ v: 1 }), () => ({ v: 0 }), 'x', { key, ttlSeconds: 600 });
    const hit = await withFallback(true, async () => ({ v: 2 }), () => ({ v: 0 }), 'x', { key, ttlSeconds: 600 });
    expect(hit.mode).toBe('live');
    expect(hit.data).toEqual({ v: 1 });
  });

  it('does not share an entry between two different keys', async () => {
    const live = vi.fn(async () => ({ v: 1 }));
    await withFallback(true, live, () => ({ v: 0 }), 'x', { key: freshKey(), ttlSeconds: 600 });
    await withFallback(true, live, () => ({ v: 0 }), 'x', { key: freshKey(), ttlSeconds: 600 });
    expect(live).toHaveBeenCalledTimes(2);
  });

  it('re-fetches once the TTL expires', async () => {
    vi.useFakeTimers();
    try {
      const key = freshKey();
      const live = vi.fn(async () => ({ v: 1 }));
      await withFallback(true, live, () => ({ v: 0 }), 'x', { key, ttlSeconds: 60 });
      vi.advanceTimersByTime(61_000);
      await withFallback(true, live, () => ({ v: 0 }), 'x', { key, ttlSeconds: 60 });
      expect(live).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does NOT cache a failure — the next call retries live', async () => {
    const key = freshKey();
    let attempts = 0;
    const flaky = async () => {
      attempts++;
      if (attempts === 1) throw new Error('HTTP 500');
      return { ok: true };
    };
    const first = await withFallback(true, flaky, () => ({ ok: false }), 'x', { key, ttlSeconds: 600 });
    expect(first.mode).toBe('stale');
    const second = await withFallback(true, flaky, () => ({ ok: false }), 'x', { key, ttlSeconds: 600 });
    expect(second.mode).toBe('live');
    expect(second.data).toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it('does not read or write the cache when there are no credentials', async () => {
    const key = freshKey();
    const live = vi.fn();
    const res = await withFallback(false, live, () => ({ m: true }), 'x', { key, ttlSeconds: 600 });
    expect(res.mode).toBe('mock');
    expect(live).not.toHaveBeenCalled();
    expect(cacheGet(key)).toBeUndefined(); // the mock must not be cached as if it were live
  });
});

/* ---------- fromSample ---------- */

describe('fromSample', () => {
  it('maps sample:false to mode "live" with no warning', () => {
    const res = fromSample({ sample: false, cpuPct: 12 }, 'system.overview');
    expect(res.mode).toBe('live');
    expect(res.warning).toBeUndefined();
    expect(res.data.cpuPct).toBe(12);
  });

  it('maps sample:true to mode "stale" with a warning naming the widget', () => {
    const res = fromSample({ sample: true }, 'system.gpu');
    expect(res.mode).toBe('stale');
    expect(res.warning).toMatch(/^system\.gpu:/);
  });

  it('passes the payload through untouched', () => {
    const data = { sample: true, gpus: [{ name: 'RTX 3070' }] };
    expect(fromSample(data, 'system.gpu').data).toBe(data);
  });
});

/* ---------- debug logging ---------- */

describe('DEBUG_CONNECTORS logging', () => {
  const original = process.env.DEBUG_CONNECTORS;
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    spy.mockRestore();
    if (original === undefined) delete process.env.DEBUG_CONNECTORS;
    else process.env.DEBUG_CONNECTORS = original;
  });

  it('stays silent when DEBUG_CONNECTORS is unset', async () => {
    delete process.env.DEBUG_CONNECTORS;
    await withFallback(true, async () => { throw new Error('boom'); }, () => ({}), 'x');
    expect(spy).not.toHaveBeenCalled();
  });

  it('logs the fallback reason when DEBUG_CONNECTORS=1', async () => {
    process.env.DEBUG_CONNECTORS = '1';
    await withFallback(true, async () => { throw new Error('HTTP 401'); }, () => ({}), 'stripe.balance');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain('stripe.balance');
    expect(String(spy.mock.calls[0][0])).toContain('HTTP 401');
  });
});
