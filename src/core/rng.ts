/** Small seeded PRNG (mulberry32). Seed lives in the save, so random events replay identically. */
export interface Rng {
  next(): number;
  readonly seed: number;
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    get seed() {
      return s;
    },
  };
}

/** Picks a random element; arrays here always come from validated non-empty content. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}
