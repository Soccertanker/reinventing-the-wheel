/**
 * "producers": click to make wheels, buy things that make wheels for you. The classic idle loop.
 * Used by the Stone Age.
 */
import { arr, num, obj, str, uniqueIds } from '../content';
import type { MechanicState } from '../state';
import { costAt, produce, type Mechanic } from './types';

export interface Producer {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costGrowth: number;
  wheelsPerSecond: number;
  /** log line when the first one is bought */
  firstBuy: string;
}

export interface ProducersParams {
  clickLabel: string;
  clickYield: number;
  producers: Producer[];
}

export interface ProducersState extends MechanicState {
  owned: Record<string, number>;
}

export function producerCost(p: Producer, s: ProducersState): number {
  return costAt(p.baseCost, p.costGrowth, s.owned[p.id] ?? 0);
}

export function producersRate(s: ProducersState, c: ProducersParams, bonus: number): number {
  return c.producers.reduce((sum, p) => sum + p.wheelsPerSecond * (s.owned[p.id] ?? 0), 0) * bonus;
}

export const producers: Mechanic<ProducersParams, ProducersState> = {
  validate(raw, path) {
    const o = obj(raw, path);
    return {
      clickLabel: str(o, 'clickLabel', path),
      clickYield: num(o, 'clickYield', path, { min: 0 }),
      producers: uniqueIds(
        arr(o, 'producers', path).map((r, i) => {
          const p = obj(r, `${path}.producers[${i}]`);
          const pp = `${path}.producers[${i}]`;
          return {
            id: str(p, 'id', pp),
            name: str(p, 'name', pp),
            description: str(p, 'description', pp),
            baseCost: num(p, 'baseCost', pp, { min: 1 }),
            costGrowth: num(p, 'costGrowth', pp, { min: 1 }),
            wheelsPerSecond: num(p, 'wheelsPerSecond', pp, { min: 0 }),
            firstBuy: str(p, 'firstBuy', pp),
          };
        }),
        `${path}.producers`,
      ),
    };
  },

  init: () => ({ wheels: 0, made: 0, owned: {} }),

  tick(s, c, dt, ctx) {
    produce(s, producersRate(s, c, ctx.bonus) * dt);
  },

  act(s, c, a, ctx) {
    if (a.type === 'click') produce(s, c.clickYield * ctx.bonus);
    if (a.type === 'buy') {
      const p = c.producers.find((x) => x.id === a.id);
      if (!p) return;
      const cost = producerCost(p, s);
      if (s.wheels < cost) return;
      s.wheels -= cost;
      const owned = (s.owned[p.id] ?? 0) + 1;
      s.owned[p.id] = owned;
      if (owned === 1) ctx.log(p.firstBuy);
    }
  },
};
