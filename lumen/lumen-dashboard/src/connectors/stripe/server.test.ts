import { describe, it, expect } from 'vitest';
import { bucketByDay, parsePaidCharges, type ParsedCharge } from './server';

/** Local midnight N days ago, as unix seconds — matches how dayKey buckets. */
function secondsAgoDays(days: number, hour = 12): number {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return Math.floor(d.getTime() / 1000);
}

function charge(created: number, amount: number, currency = 'chf'): ParsedCharge {
  return { created, amount, currency };
}

/* ---------- parsePaidCharges ---------- */

describe('parsePaidCharges', () => {
  it('keeps only charges that are both paid and succeeded', () => {
    const body = {
      data: [
        { amount: 1000, currency: 'CHF', created: 100, paid: true, status: 'succeeded' },
        { amount: 2000, currency: 'chf', created: 200, paid: false, status: 'succeeded' }, // not paid
        { amount: 3000, currency: 'chf', created: 300, paid: true, status: 'pending' }, // not settled
        { amount: 4000, currency: 'chf', created: 400, paid: true, status: 'failed' },
      ],
    };
    const out = parsePaidCharges(body);
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(1000);
  });

  it('lowercases the currency', () => {
    const out = parsePaidCharges({ data: [{ amount: 1, currency: 'EUR', created: 1, paid: true, status: 'succeeded' }] });
    expect(out[0].currency).toBe('eur');
  });

  it('treats amount as a plain number in minor units, not a string', () => {
    const out = parsePaidCharges({ data: [{ amount: 12345, currency: 'chf', created: 1, paid: true, status: 'succeeded' }] });
    expect(out[0].amount).toBe(12345);
  });

  it('returns an empty array for anything that is not a charge list', () => {
    for (const junk of [null, undefined, 42, 'string', [], {}, { data: null }, { data: 'nope' }]) {
      expect(parsePaidCharges(junk)).toEqual([]);
    }
  });

  it('skips non-object entries inside data', () => {
    expect(parsePaidCharges({ data: [null, 5, 'x', { amount: 1, created: 1, paid: true, status: 'succeeded' }] })).toHaveLength(1);
  });

  it('defaults a missing currency rather than emitting undefined', () => {
    const out = parsePaidCharges({ data: [{ amount: 1, created: 1, paid: true, status: 'succeeded' }] });
    expect(out[0].currency).toBe('chf');
  });
});

/* ---------- bucketByDay ---------- */

describe('bucketByDay', () => {
  it('returns one point per day in the window, oldest first', () => {
    const series = bucketByDay([], 7);
    expect(series).toHaveLength(7);
    const dates = series.map((p) => p.date);
    expect([...dates].sort()).toEqual(dates); // already ascending
  });

  it('zero-fills days with no charges', () => {
    const series = bucketByDay([], 5);
    expect(series.every((p) => p.amount === 0)).toBe(true);
  });

  it('emits YYYY-MM-DD dates', () => {
    for (const p of bucketByDay([], 3)) expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('puts a charge in its own local calendar day', () => {
    const series = bucketByDay([charge(secondsAgoDays(2), 5000)], 7);
    const nonZero = series.filter((p) => p.amount !== 0);
    expect(nonZero).toHaveLength(1);
    expect(nonZero[0].amount).toBe(5000);
    // 7-day window, index 0 is 6 days ago, so 2 days ago is index 4.
    expect(series.indexOf(nonZero[0])).toBe(4);
  });

  it('sums multiple charges landing on the same day', () => {
    const series = bucketByDay([charge(secondsAgoDays(1, 9), 1000), charge(secondsAgoDays(1, 17), 2500)], 7);
    expect(series.filter((p) => p.amount !== 0)).toHaveLength(1);
    expect(series.find((p) => p.amount !== 0)!.amount).toBe(3500);
  });

  it('ignores charges older than the window instead of folding them into the first bucket', () => {
    const series = bucketByDay([charge(secondsAgoDays(40), 9999)], 7);
    expect(series.every((p) => p.amount === 0)).toBe(true);
    expect(series.reduce((s, p) => s + p.amount, 0)).toBe(0);
  });

  it('ignores future-dated charges instead of folding them into the last bucket', () => {
    const series = bucketByDay([charge(secondsAgoDays(-5), 9999)], 7);
    expect(series.every((p) => p.amount === 0)).toBe(true);
  });

  it('includes a charge from today', () => {
    const series = bucketByDay([charge(secondsAgoDays(0), 777)], 7);
    expect(series[series.length - 1].amount).toBe(777);
  });

  it('includes a charge on the oldest day of the window (inclusive boundary)', () => {
    const series = bucketByDay([charge(secondsAgoDays(6), 123)], 7);
    expect(series[0].amount).toBe(123);
  });

  it('excludes the day just before the window (exclusive boundary)', () => {
    const series = bucketByDay([charge(secondsAgoDays(7), 123)], 7);
    expect(series.every((p) => p.amount === 0)).toBe(true);
  });

  it('handles a single-day window', () => {
    const series = bucketByDay([charge(secondsAgoDays(0), 500)], 1);
    expect(series).toHaveLength(1);
    expect(series[0].amount).toBe(500);
  });

  it('handles the 90-day maximum window', () => {
    const series = bucketByDay([charge(secondsAgoDays(89), 100), charge(secondsAgoDays(0), 200)], 90);
    expect(series).toHaveLength(90);
    expect(series[0].amount).toBe(100);
    expect(series[89].amount).toBe(200);
    expect(series.reduce((s, p) => s + p.amount, 0)).toBe(300);
  });

  it('produces no duplicate dates', () => {
    const dates = bucketByDay([], 90).map((p) => p.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('is deterministic for a fixed `now`, and crosses a month boundary correctly', () => {
    // 2026-03-02T12:00 local; a 4-day window must reach back into February.
    const now = new Date(2026, 2, 2, 12, 0, 0, 0).getTime();
    const series = bucketByDay([], 4, now);
    expect(series.map((p) => p.date)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  });

  it('handles a leap day', () => {
    const now = new Date(2028, 2, 1, 12, 0, 0, 0).getTime(); // 2028 is a leap year
    expect(bucketByDay([], 3, now).map((p) => p.date)).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  });
});
