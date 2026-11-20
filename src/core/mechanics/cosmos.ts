/**
 * "cosmos": prestige by way of physics. Set the constants of a new universe (pi! gravity!),
 * Big Bang it, and watch civilizations rise and independently reinvent the wheel.
 * - Wrong pi: civilizations invent polygons. They do not roll.
 * - Gravity off from 1: the universe dies young or never forms stars.
 * - Crunching a universe converts its wheels into Insight, a permanent multiplier on all
 *   future universes. Upgrades speed up time and, eventually, re-Bang automatically.
 * Used by the Post-singularity/Cosmic era.
 */
import { arr, num, obj, str, strs } from '../content';
import { pick } from '../rng';
import type { MechanicState } from '../state';
import { costAt, produce, type Mechanic } from './types';

export interface Milestone {
  age: number;
  text: string;
}

export interface CosmosParams {
  /** billion years per second at 1x */
  gyPerSecond: number;
  baseLifespanGy: number;
  starsAtGy: number;
  lifeAtGy: number;
  civsAtGy: number;
  maxCivs: number;
  civGrowth: number;
  wheelsPerCiv: number;
  piTolerance: number;
  gravityTolerance: number;
  insightPerLog: number;
  pump: { name: string; baseCost: number; costGrowth: number; speedup: number };
  daemon: { name: string; cost: number };
  milestones: Milestone[];
  badPi: string[];
  noStars: string[];
  deaths: string[];
}

export interface Universe {
  pi: number;
  gravity: number;
  age: number;
  lifespan: number;
  civs: number;
  wheels: number;
  alive: boolean;
  milestone: number;
}

export interface CosmosState extends MechanicState {
  pi: number;
  /** log10 of gravity, so the slider is symmetric around 1 */
  logGravity: number;
  universe: Universe | null;
  insight: number;
  universes: number;
  pumps: number;
  daemon: boolean;
}

/** 1 at true pi; falls off fast. */
export const piQuality = (pi: number, tol: number) => Math.exp(-(((pi - Math.PI) / tol) ** 2));

export function lifespanGy(c: CosmosParams, gravity: number): number {
  return c.baseLifespanGy * Math.exp(-((Math.log10(gravity) / c.gravityTolerance) ** 2));
}

export const pumpCost = (c: CosmosParams, s: CosmosState) => costAt(c.pump.baseCost, c.pump.costGrowth, s.pumps);
export const timeSpeed = (c: CosmosParams, s: CosmosState) => c.gyPerSecond * c.pump.speedup ** s.pumps;
export const insightMultiplier = (s: CosmosState) => 1 + s.insight;
export const insightFor = (c: CosmosParams, wheels: number) => Math.log10(1 + wheels) * c.insightPerLog;

function bang(s: CosmosState, c: CosmosParams, ctx: { log: (m: string) => void; rng: () => number }) {
  const gravity = 10 ** s.logGravity;
  s.universes++;
  s.universe = { pi: s.pi, gravity, age: 0, lifespan: lifespanGy(c, gravity), civs: 0, wheels: 0, alive: true, milestone: 0 };
  ctx.log(`Universe #${s.universes} begins. pi = ${s.pi.toFixed(5)}, gravity = ${gravity.toFixed(2)}g.`);
  if (piQuality(s.pi, c.piTolerance) < 0.05) ctx.log(pick(ctx.rng, c.badPi));
  if (s.universe.lifespan < c.starsAtGy) ctx.log(pick(ctx.rng, c.noStars));
}

function crunch(s: CosmosState, c: CosmosParams, ctx: { log: (m: string) => void }) {
  const u = s.universe;
  if (!u) return;
  const gained = insightFor(c, u.wheels);
  s.insight += gained;
  ctx.log(`Universe #${s.universes} crunched into a point. Insight +${gained.toFixed(2)}. The wheels remember.`);
  s.universe = null;
}

export const cosmos: Mechanic<CosmosParams, CosmosState> = {
  validate(raw, path) {
    const o = obj(raw, path);
    const pump = obj(o.pump, `${path}.pump`);
    const daemon = obj(o.daemon, `${path}.daemon`);
    return {
      gyPerSecond: num(o, 'gyPerSecond', path, { min: 0 }),
      baseLifespanGy: num(o, 'baseLifespanGy', path, { min: 0 }),
      starsAtGy: num(o, 'starsAtGy', path, { min: 0 }),
      lifeAtGy: num(o, 'lifeAtGy', path, { min: 0 }),
      civsAtGy: num(o, 'civsAtGy', path, { min: 0 }),
      maxCivs: num(o, 'maxCivs', path, { min: 1 }),
      civGrowth: num(o, 'civGrowth', path, { min: 0 }),
      wheelsPerCiv: num(o, 'wheelsPerCiv', path, { min: 0 }),
      piTolerance: num(o, 'piTolerance', path, { min: 0.00001 }),
      gravityTolerance: num(o, 'gravityTolerance', path, { min: 0.01 }),
      insightPerLog: num(o, 'insightPerLog', path, { min: 0 }),
      pump: {
        name: str(pump, 'name', path),
        baseCost: num(pump, 'baseCost', path, { min: 1 }),
        costGrowth: num(pump, 'costGrowth', path, { min: 1 }),
        speedup: num(pump, 'speedup', path, { min: 1 }),
      },
      daemon: { name: str(daemon, 'name', path), cost: num(daemon, 'cost', path, { min: 1 }) },
      milestones: arr(o, 'milestones', path).map((m, i) => {
        const mm = obj(m, `${path}.milestones[${i}]`);
        return { age: num(mm, 'age', path, { min: 0 }), text: str(mm, 'text', path) };
      }),
      badPi: strs(o, 'badPi', path),
      noStars: strs(o, 'noStars', path),
      deaths: strs(o, 'deaths', path),
    };
  },

  init: () => ({ wheels: 0, made: 0, pi: 3, logGravity: 0.6, universe: null, insight: 0, universes: 0, pumps: 0, daemon: false }),

  tick(s, c, dt, ctx) {
    const u = s.universe;
    if (!u || !u.alive) {
      if (s.daemon) {
        crunch(s, c, ctx);
        bang(s, c, ctx);
      }
      return;
    }
    u.age += timeSpeed(c, s) * dt;
    while (u.milestone < c.milestones.length && u.age >= (c.milestones[u.milestone]?.age ?? Infinity)) {
      if (u.age < u.lifespan) ctx.log(c.milestones[u.milestone]?.text ?? '');
      u.milestone++;
    }
    if (u.age >= c.civsAtGy && u.lifespan > c.civsAtGy) {
      // Logistic growth of wheel-inventing civilizations.
      if (u.civs < 1) u.civs = 1;
      u.civs += c.civGrowth * u.civs * (1 - u.civs / c.maxCivs) * timeSpeed(c, s) * dt;
      const made = u.civs * c.wheelsPerCiv * piQuality(u.pi, c.piTolerance) * insightMultiplier(s) * ctx.bonus * dt;
      u.wheels += made;
      produce(s, made);
    }
    if (u.age >= u.lifespan) {
      u.alive = false;
      ctx.log(`${pick(ctx.rng, c.deaths)} (Universe #${s.universes} lasted ${u.lifespan.toFixed(1)} billion years.)`);
    }
  },

  act(s, c, a, ctx) {
    switch (a.type) {
      case 'pi':
        s.pi = Math.max(3, Math.min(3.3, Number(a.value) || 3));
        break;
      case 'gravity':
        s.logGravity = Math.max(-1, Math.min(1, Number(a.value) || 0));
        break;
      case 'bang':
        if (!s.universe?.alive) bang(s, c, ctx);
        break;
      case 'crunch':
        crunch(s, c, ctx);
        if (s.daemon) bang(s, c, ctx);
        break;
      case 'buyPump': {
        const cost = pumpCost(c, s);
        if (s.wheels < cost) return;
        s.wheels -= cost;
        s.pumps++;
        break;
      }
      case 'buyDaemon':
        if (s.daemon || s.wheels < c.daemon.cost) return;
        s.wheels -= c.daemon.cost;
        s.daemon = true;
        ctx.log(`${c.daemon.name} online. It will Big Bang new universes for you, forever, with no breaks. Like a cosmic intern.`);
        break;
    }
  },
};
