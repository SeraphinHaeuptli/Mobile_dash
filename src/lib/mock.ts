/** Deterministic helpers so mock data looks plausible and stays stable between refreshes. */

export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

export function intBetween(rnd: () => number, min: number, max: number) {
  return Math.floor(min + rnd() * (max - min + 1));
}

/** A gently wandering series, e.g. for sparklines. */
export function walk(rnd: () => number, n: number, start: number, volatility = 0.06, min = 0, max = Infinity) {
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v = Math.min(max, Math.max(min, v * (1 + (rnd() - 0.45) * volatility)));
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

/** ISO string offset from now by `mins` minutes. */
export function minutesFromNow(mins: number) {
  return new Date(Date.now() + mins * 60000).toISOString();
}
