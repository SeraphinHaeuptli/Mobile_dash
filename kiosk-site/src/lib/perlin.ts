/**
 * Classic 2D Perlin noise.
 *
 * Hand-written rather than pulled from a package: the wave field needs one
 * function, and a seeded permutation table means the field looks identical on
 * every load instead of reshuffling itself between visits.
 */

const TABLE_SIZE = 256;

/** Eight unit gradients — the standard 2D set, so no vector needs normalising. */
const GRADIENTS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, -Math.SQRT1_2],
  [-Math.SQRT1_2, -Math.SQRT1_2],
];

/** Mulberry32 — a small, fast PRNG, enough to shuffle 256 entries repeatably. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A shuffled 0–255 table, doubled so lookups can index up to 511 without a
 * modulo on every sample.
 */
function permutation(seed: number): Uint8Array {
  const next = random(seed);
  const source = new Uint8Array(TABLE_SIZE);
  for (let i = 0; i < TABLE_SIZE; i += 1) source[i] = i;

  // Fisher-Yates.
  for (let i = TABLE_SIZE - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [source[i], source[j]] = [source[j], source[i]];
  }

  const table = new Uint8Array(TABLE_SIZE * 2);
  table.set(source, 0);
  table.set(source, TABLE_SIZE);
  return table;
}

/** Ken Perlin's improved smoothstep: zero first and second derivatives at 0 and 1. */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function dot(hash: number, x: number, y: number): number {
  const [gx, gy] = GRADIENTS[hash & 7];
  return gx * x + gy * y;
}

export interface Noise2D {
  /** A single octave, returning roughly -1 to 1. */
  (x: number, y: number): number;
}

export function createNoise2D(seed = 1): Noise2D {
  const table = permutation(seed);

  return (x, y) => {
    // Integer cell, and the position within it.
    const cellX = Math.floor(x) & 255;
    const cellY = Math.floor(y) & 255;
    const fracX = x - Math.floor(x);
    const fracY = y - Math.floor(y);

    const u = fade(fracX);
    const v = fade(fracY);

    // The four corner gradients of this cell.
    const a = table[cellX] + cellY;
    const b = table[cellX + 1] + cellY;

    return lerp(
      lerp(
        dot(table[a], fracX, fracY),
        dot(table[b], fracX - 1, fracY),
        u,
      ),
      lerp(
        dot(table[a + 1], fracX, fracY - 1),
        dot(table[b + 1], fracX - 1, fracY - 1),
        u,
      ),
      v,
    );
  };
}

/**
 * Fractal Brownian motion: octaves at doubling frequency and halving amplitude.
 * One octave of Perlin is too smooth to read as water; three gives the field
 * both a long swell and the fine chop on top of it.
 */
export function fbm(
  noise: Noise2D,
  x: number,
  y: number,
  octaves: number,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;

  for (let i = 0; i < octaves; i += 1) {
    value += noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  // Normalised back to the single-octave range so callers can scale it directly.
  return value / total;
}
