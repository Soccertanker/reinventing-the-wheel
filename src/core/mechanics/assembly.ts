/**
 * "assembly": a steam-powered production line. Raw material flows through stages
 * (each stage turns inputs into an output); the last stage makes wheels.
 * - Throughput is limited by the slowest stage (find and fix the bottleneck).
 * - Machines only run on boiler pressure. Higher pressure = faster, but over 100 it explodes
 *   and wrecks a machine. Shovel coal by hand, or hire stokers; the safety valve trades speed for safety.
 * Used by the Industrial era.
 */
import { arr, num, obj, str, strs, uniqueIds } from '../content';
import { pick } from '../rng';
import type { MechanicState } from '../state';
import { costAt, produce, type Mechanic } from './types';

export interface Stage {
  id: string;
  name: string;
  machine: string;
  /** resource -> amount consumed per cycle */
  inputs: Record<string, number>;
  /** resource produced per cycle ("wheel" = finished wheels) */
  output: string;
  outputQty: number;
  /** cycles per second per machine at 1x speed */
  rate: number;
  baseCost: number;
  costGrowth: number;
}

export interface AssemblyParams {
  stages: Stage[];
  resources: Record<string, string>;
  /** pressure added per shovel click */
  shovel: number;
  /** pressure used per running machine per second */
  steamPerMachine: number;
  stoker: { name: string; pressurePerSecond: number; baseCost: number; costGrowth: number };
  valveAt: number;
  explosions: string[];
  shovelQuips: string[];
}

export interface AssemblyState extends MechanicState {
  pressure: number;
  machines: Record<string, number>;
  stock: Record<string, number>;
  stokers: number;
  valve: boolean;
  explosions: number;
  shovels: number;
}

export const MAX_PRESSURE = 100;

/** Speed multiplier from pressure: idle when empty, 0.5x..1.5x otherwise. */
export function speedAt(pressure: number): number {
  return pressure <= 0 ? 0 : 0.5 + pressure / MAX_PRESSURE;
}

export function machineCost(st: Stage, s: AssemblyState): number {
  return costAt(st.baseCost, st.costGrowth, (s.machines[st.id] ?? 1) - 1);
}

export function stokerCost(c: AssemblyParams, s: AssemblyState): number {
  return costAt(c.stoker.baseCost, c.stoker.costGrowth, s.stokers);
}

export const assembly: Mechanic<AssemblyParams, AssemblyState> = {
  validate(raw, path) {
    const o = obj(raw, path);
    const stoker = obj(o.stoker, `${path}.stoker`);
    const resources = obj(o.resources, `${path}.resources`) as Record<string, string>;
    const stages = uniqueIds(
      arr(o, 'stages', path).map((r, i) => {
        const pp = `${path}.stages[${i}]`;
        const st = obj(r, pp);
        const inputs = obj(st.inputs, `${pp}.inputs`);
        for (const [k, v] of Object.entries(inputs)) {
          if (typeof v !== 'number' || v <= 0) throw new Error(`${pp}.inputs.${k}: expected positive number`);
        }
        return {
          id: str(st, 'id', pp),
          name: str(st, 'name', pp),
          machine: str(st, 'machine', pp),
          inputs: inputs as Record<string, number>,
          output: str(st, 'output', pp),
          outputQty: num(st, 'outputQty', pp, { min: 0 }),
          rate: num(st, 'rate', pp, { min: 0 }),
          baseCost: num(st, 'baseCost', pp, { min: 1 }),
          costGrowth: num(st, 'costGrowth', pp, { min: 1 }),
        };
      }),
      `${path}.stages`,
    );
    if (stages.at(-1)?.output !== 'wheel') throw new Error(`${path}.stages: last stage must output "wheel"`);
    return {
      stages,
      resources,
      shovel: num(o, 'shovel', path, { min: 0 }),
      steamPerMachine: num(o, 'steamPerMachine', path, { min: 0 }),
      stoker: {
        name: str(stoker, 'name', `${path}.stoker`),
        pressurePerSecond: num(stoker, 'pressurePerSecond', `${path}.stoker`, { min: 0 }),
        baseCost: num(stoker, 'baseCost', `${path}.stoker`, { min: 1 }),
        costGrowth: num(stoker, 'costGrowth', `${path}.stoker`, { min: 1 }),
      },
      valveAt: num(o, 'valveAt', path, { min: 1, max: MAX_PRESSURE }),
      explosions: strs(o, 'explosions', path),
      shovelQuips: strs(o, 'shovelQuips', path),
    };
  },

  init: (c) => ({
    wheels: 0,
    made: 0,
    pressure: 0,
    machines: Object.fromEntries(c.stages.map((st) => [st.id, 1])),
    stock: {},
    stokers: 0,
    valve: true,
    explosions: 0,
    shovels: 0,
  }),

  tick(s, c, dt, ctx) {
    s.pressure += s.stokers * c.stoker.pressurePerSecond * dt;
    if (s.valve && s.pressure > c.valveAt) s.pressure = c.valveAt;

    if (s.pressure > MAX_PRESSURE) {
      s.explosions++;
      s.pressure = 15;
      const wrecked = c.stages.filter((st) => (s.machines[st.id] ?? 0) > 1);
      if (wrecked.length) {
        const st = pick(ctx.rng, wrecked);
        s.machines[st.id] = (s.machines[st.id] ?? 1) - 1;
        ctx.log(`${pick(ctx.rng, c.explosions)} (Lost one ${st.machine}.)`);
      } else {
        ctx.log(pick(ctx.rng, c.explosions));
      }
    }

    const speed = speedAt(s.pressure);
    if (speed === 0) return;
    // 1. What each stage would like to run this tick.
    const want = c.stages.map((st) => (s.machines[st.id] ?? 0) * st.rate * speed * dt * (st.output === 'wheel' ? ctx.bonus : 1));
    // 2. Stages that share an input split it in proportion to demand (no stage can starve another).
    const demand: Record<string, number> = {};
    c.stages.forEach((st, i) => {
      for (const [res, qty] of Object.entries(st.inputs)) demand[res] = (demand[res] ?? 0) + (want[i] ?? 0) * qty;
    });
    const share = (res: string) => Math.min(1, (s.stock[res] ?? 0) / (demand[res] || 1));
    const cycles = c.stages.map((st, i) => Object.keys(st.inputs).reduce((cy, res) => Math.min(cy, (want[i] ?? 0) * share(res)), want[i] ?? 0));
    // 3. Consume, then produce (outputs are usable from the next tick).
    let running = 0;
    c.stages.forEach((st, i) => {
      const cy = cycles[i] ?? 0;
      if (cy <= 0) return;
      running += s.machines[st.id] ?? 0;
      for (const [res, qty] of Object.entries(st.inputs)) s.stock[res] = Math.max(0, (s.stock[res] ?? 0) - cy * qty);
    });
    c.stages.forEach((st, i) => {
      const out = (cycles[i] ?? 0) * st.outputQty;
      if (out <= 0) return;
      if (st.output === 'wheel') produce(s, out);
      else s.stock[st.output] = (s.stock[st.output] ?? 0) + out;
    });
    s.pressure = Math.max(0, s.pressure - running * c.steamPerMachine * dt);
  },

  act(s, c, a, ctx) {
    switch (a.type) {
      case 'shovel':
        s.pressure += c.shovel;
        s.shovels++;
        if (s.shovels % 25 === 0) ctx.log(pick(ctx.rng, c.shovelQuips));
        break;
      case 'buyMachine': {
        const st = c.stages.find((x) => x.id === a.stage);
        if (!st) return;
        const cost = machineCost(st, s);
        if (s.wheels < cost) return;
        s.wheels -= cost;
        s.machines[st.id] = (s.machines[st.id] ?? 0) + 1;
        break;
      }
      case 'buyStoker': {
        const cost = stokerCost(c, s);
        if (s.wheels < cost) return;
        s.wheels -= cost;
        s.stokers++;
        if (s.stokers === 1) ctx.log(`You hired a ${c.stoker.name}. They shovel. They do not speak.`);
        break;
      }
      case 'valve':
        s.valve = !s.valve;
        ctx.log(s.valve ? 'Safety valve closed... er, opened. The safe way.' : 'Safety valve disabled. Bold. Industrial. Probably fine.');
        break;
    }
  },
};
