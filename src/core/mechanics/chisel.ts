/**
 * "chisel": a tactile alternative to "producers". Every rock starts as a crude polygon; each tap
 * knocks off a corner (one more side). Once it has enough sides it's round enough to be a wheel,
 * and a new rock appears. Upgrades knock off more corners per tap, chip automatically, or start
 * with better rocks.
 */
import { arr, num, obj, str, strs, uniqueIds } from '../content';
import { pick } from '../rng';
import type { MechanicState } from '../state';
import { costAt, produce, type Mechanic } from './types';

export type UpgradeKind = 'tap' | 'auto' | 'start';

export interface ChiselUpgrade {
  id: string;
  name: string;
  description: string;
  /** tap: +corners per tap · auto: +corners per second · start: +starting sides */
  kind: UpgradeKind;
  amount: number;
  baseCost: number;
  costGrowth: number;
  firstBuy: string;
  /** optional cap on how many can be owned */
  max?: number;
}

export interface ChiselParams {
  startSides: number;
  roundAt: number;
  upgrades: ChiselUpgrade[];
  completions: string[];
  /** show a completion quip every N wheels */
  quipEvery: number;
}

export interface ChiselState extends MechanicState {
  /** sides of the rock currently being chiseled */
  sides: number;
  owned: Record<string, number>;
  taps: number;
}

const total = (c: ChiselParams, s: ChiselState, kind: UpgradeKind) =>
  c.upgrades.filter((u) => u.kind === kind).reduce((sum, u) => sum + u.amount * (s.owned[u.id] ?? 0), 0);

export const cornersPerTap = (c: ChiselParams, s: ChiselState) => 1 + total(c, s, 'tap');
export const cornersPerSecond = (c: ChiselParams, s: ChiselState) => total(c, s, 'auto');
export const startSides = (c: ChiselParams, s: ChiselState) => Math.min(c.roundAt - 1, c.startSides + total(c, s, 'start'));
export const upgradeCost = (u: ChiselUpgrade, s: ChiselState) => costAt(u.baseCost, u.costGrowth, s.owned[u.id] ?? 0);
export const corners = (c: ChiselParams, s: ChiselState) => c.roundAt - startSides(c, s);
export const wheelsPerSecond = (c: ChiselParams, s: ChiselState, bonus: number) => (cornersPerSecond(c, s) * bonus) / corners(c, s);

/** Knock off `n` corners; finished rocks become wheels (overflow carries into the next rock). */
function chip(s: ChiselState, c: ChiselParams, n: number, ctx: { rng: () => number; log: (m: string) => void }) {
  s.sides += n;
  const start = startSides(c, s);
  const per = c.roundAt - start;
  if (s.sides < c.roundAt) return;
  const done = Math.floor((s.sides - start) / per);
  const before = Math.floor(s.made / c.quipEvery);
  produce(s, done);
  s.sides = start + ((s.sides - start) % per);
  if (Math.floor(s.made / c.quipEvery) > before) ctx.log(`Wheel #${Math.floor(s.made)}: ${pick(ctx.rng, c.completions)}`);
}

export const chisel: Mechanic<ChiselParams, ChiselState> = {
  validate(raw, path) {
    const o = obj(raw, path);
    const startSidesV = num(o, 'startSides', path, { min: 3 });
    const roundAt = num(o, 'roundAt', path, { min: startSidesV + 1 });
    return {
      startSides: startSidesV,
      roundAt,
      quipEvery: num(o, 'quipEvery', path, { min: 1 }),
      completions: strs(o, 'completions', path),
      upgrades: uniqueIds(
        arr(o, 'upgrades', path).map((r, i) => {
          const pp = `${path}.upgrades[${i}]`;
          const u = obj(r, pp);
          const kind = str(u, 'kind', pp);
          if (kind !== 'tap' && kind !== 'auto' && kind !== 'start') throw new Error(`${pp}.kind: expected tap|auto|start`);
          return {
            id: str(u, 'id', pp),
            name: str(u, 'name', pp),
            description: str(u, 'description', pp),
            kind,
            amount: num(u, 'amount', pp, { min: 0 }),
            baseCost: num(u, 'baseCost', pp, { min: 1 }),
            costGrowth: num(u, 'costGrowth', pp, { min: 1 }),
            firstBuy: str(u, 'firstBuy', pp),
            max: u.max === undefined ? undefined : num(u, 'max', pp, { min: 1 }),
          };
        }),
        `${path}.upgrades`,
      ),
    };
  },

  init: (c) => ({ wheels: 0, made: 0, sides: c.startSides, owned: {}, taps: 0 }),

  tick(s, c, dt, ctx) {
    const n = cornersPerSecond(c, s) * ctx.bonus * dt;
    if (n > 0) chip(s, c, n, ctx);
  },

  act(s, c, a, ctx) {
    if (a.type === 'tap') {
      s.taps++;
      chip(s, c, cornersPerTap(c, s) * ctx.bonus, ctx);
    }
    if (a.type === 'buy') {
      const u = c.upgrades.find((x) => x.id === a.id);
      if (!u) return;
      const owned = s.owned[u.id] ?? 0;
      if (u.max !== undefined && owned >= u.max) return;
      const cost = upgradeCost(u, s);
      if (s.wheels < cost) return;
      s.wheels -= cost;
      s.owned[u.id] = owned + 1;
      if (owned === 0) ctx.log(u.firstBuy);
      // A better starting rock also improves the one in progress.
      if (u.kind === 'start') s.sides = Math.max(s.sides, startSides(c, s));
    }
  },
};
