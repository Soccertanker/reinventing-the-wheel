import type { Era, Producer } from './content';
import type { GameState } from './state';

/** Max offline time credited, so a wrong device clock can't grant infinite wheels. */
export const MAX_OFFLINE_MS = 1000 * 60 * 60 * 24;

export function costOf(p: Producer, owned: number): number {
  return Math.ceil(p.baseCost * p.costGrowth ** owned);
}

export function wheelsPerSecond(state: GameState, era: Era): number {
  return era.producers.reduce((sum, p) => sum + p.wheelsPerSecond * (state.owned[p.id] ?? 0), 0);
}

/** Advance the simulation to `now`. Pure: returns a new state. Deterministic for a given input. */
export function advance(state: GameState, era: Era, now: number): GameState {
  const dtMs = Math.min(Math.max(0, now - state.lastTickAt), MAX_OFFLINE_MS);
  const gained = (wheelsPerSecond(state, era) * dtMs) / 1000;
  return {
    ...state,
    wheels: state.wheels + gained,
    totalWheels: state.totalWheels + gained,
    lastTickAt: now,
  };
}

export function reinvent(state: GameState, era: Era): GameState {
  return {
    ...state,
    wheels: state.wheels + era.clickYield,
    totalWheels: state.totalWheels + era.clickYield,
  };
}

/** Returns the new state, or the same state object if unaffordable/unknown. */
export function buy(state: GameState, era: Era, producerId: string): GameState {
  const p = era.producers.find((x) => x.id === producerId);
  if (!p) return state;
  const owned = state.owned[p.id] ?? 0;
  const cost = costOf(p, owned);
  if (state.wheels < cost) return state;
  return {
    ...state,
    wheels: state.wheels - cost,
    owned: { ...state.owned, [p.id]: owned + 1 },
  };
}
