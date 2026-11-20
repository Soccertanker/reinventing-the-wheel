import type { MechanicState } from '../state';

export interface Ctx {
  /** seeded random in [0, 1) */
  rng: () => number;
  /** append a line to this era's log */
  log: (msg: string) => void;
  /** production multiplier from completed earlier eras */
  bonus: number;
}

export type Action = { type: string } & Record<string, unknown>;

/**
 * A reusable era mechanic. Pure and DOM-free: state is plain JSON (it goes in the save),
 * tick/act mutate a draft the engine has already cloned.
 * C = validated content params, S = per-era state.
 */
export interface Mechanic<C, S extends MechanicState> {
  validate(params: unknown, path: string): C;
  init(c: C): S;
  tick(s: S, c: C, dtSec: number, ctx: Ctx): void;
  act(s: S, c: C, action: Action, ctx: Ctx): void;
}

/** Adds wheels to an era (shared by every mechanic). */
export function produce(s: MechanicState, n: number): void {
  s.wheels += n;
  s.made += n;
}

export function costAt(baseCost: number, growth: number, owned: number): number {
  return Math.ceil(baseCost * growth ** owned);
}
