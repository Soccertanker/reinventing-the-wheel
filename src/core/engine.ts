/**
 * Runs all eras. Pure: takes a state, returns a new one.
 * Simulation uses fixed 250 ms ticks (leftover time carries over in pendingMs), and random
 * events use the seeded RNG stored in the save, so results don't depend on frame rate or on
 * how offline time is split up.
 */
import type { Era } from './eras';
import type { Action, Ctx } from './mechanics/types';
import { makeRng } from './rng';
import { CURRENT_SCHEMA_VERSION, type GameState, type MechanicState } from './state';

export const TICK_MS = 250;
/** Max offline time credited, so a wrong device clock can't grant infinite wheels. */
export const MAX_OFFLINE_MS = 1000 * 60 * 60 * 24;
const LOG_LIMIT = 60;

export function newGame(eras: readonly Era[], now: number, seed = (now ^ 0x5eed) >>> 0): GameState {
  const first = eras[0];
  if (!first) throw new Error('no eras');
  const s: GameState = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    lastTickAt: now,
    pendingMs: 0,
    rngSeed: seed,
    currentEra: first.id,
    unlocked: [first.id],
    completed: [],
    eras: { [first.id]: first.impl.init(first.config) },
    log: [],
    logSeq: 0,
  };
  addLog(s, first.id, first.intro);
  return s;
}

/**
 * Fills in anything content added since the save was written (new eras, new state fields),
 * and drops eras that no longer exist in content. Call after loading a save.
 */
export function hydrate(state: GameState, eras: readonly Era[]): GameState {
  const s = structuredClone(state);
  const known = new Set(eras.map((e) => e.id));
  for (const e of eras) {
    if (s.unlocked.includes(e.id)) s.eras[e.id] = { ...e.impl.init(e.config), ...s.eras[e.id] } as MechanicState;
  }
  for (const id of Object.keys(s.eras)) if (!known.has(id)) delete s.eras[id];
  s.unlocked = s.unlocked.filter((id) => known.has(id));
  s.completed = s.completed.filter((id) => known.has(id));
  if (!s.unlocked.length && eras[0]) {
    s.unlocked = [eras[0].id];
    s.eras[eras[0].id] = eras[0].impl.init(eras[0].config);
  }
  if (!s.unlocked.includes(s.currentEra)) s.currentEra = s.unlocked[0] ?? '';
  return s;
}

function addLog(s: GameState, era: string, msg: string) {
  s.logSeq++;
  s.log.push({ seq: s.logSeq, era, msg });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

/** Product of bonuses from completed eras that come before this one. */
export function bonusFor(s: GameState, eras: readonly Era[], era: Era): number {
  return eras.filter((e) => e.order < era.order && s.completed.includes(e.id)).reduce((b, e) => b * e.bonus, 1);
}

export function lifetimeWheels(s: GameState): number {
  return Object.values(s.eras).reduce((sum, e) => sum + e.made, 0);
}

function ctxFor(s: GameState, eras: readonly Era[], era: Era, rng: () => number): Ctx {
  return { rng, bonus: bonusFor(s, eras, era), log: (msg) => addLog(s, era.id, msg) };
}

/** Marks goals met and unlocks the next era. */
function checkProgress(s: GameState, eras: readonly Era[]) {
  eras.forEach((era, i) => {
    const st = s.eras[era.id];
    if (!st || s.completed.includes(era.id) || st.made < era.goal.made) return;
    s.completed.push(era.id);
    const next = eras[i + 1];
    if (!next) {
      addLog(s, era.id, 'You have reinvented the wheel in every way it can be reinvented. It is still a wheel. It was always a wheel.');
      return;
    }
    addLog(s, era.id, `Goal reached! Everything in later eras now runs ${era.bonus}x faster. A new era awaits: ${next.name}.`);
    if (!s.unlocked.includes(next.id)) {
      s.unlocked.push(next.id);
      s.eras[next.id] = next.impl.init(next.config);
      addLog(s, next.id, next.intro);
    }
  });
}

/** Simulates `ms` of game time. */
export function advanceBy(state: GameState, eras: readonly Era[], ms: number): GameState {
  const s = structuredClone(state);
  s.pendingMs += Math.max(0, ms);
  if (s.pendingMs < TICK_MS) return s;
  const rng = makeRng(s.rngSeed);
  const r = () => rng.next();
  const dt = TICK_MS / 1000;
  while (s.pendingMs >= TICK_MS) {
    s.pendingMs -= TICK_MS;
    for (const era of eras) {
      const st = s.eras[era.id];
      if (st && s.unlocked.includes(era.id)) era.impl.tick(st, era.config, dt, ctxFor(s, eras, era, r));
    }
    checkProgress(s, eras);
  }
  s.rngSeed = rng.seed;
  return s;
}

/** Simulates up to `now` (real time), capped for offline progress. */
export function advance(state: GameState, eras: readonly Era[], now: number): GameState {
  const elapsed = Math.min(Math.max(0, now - state.lastTickAt), MAX_OFFLINE_MS);
  const s = advanceBy(state, eras, elapsed);
  s.lastTickAt = now;
  return s;
}

/** Applies a player action to one era. Unknown/locked eras and invalid actions are ignored. */
export function act(state: GameState, eras: readonly Era[], eraId: string, action: Action): GameState {
  const era = eras.find((e) => e.id === eraId);
  const st0 = state.eras[eraId];
  if (!era || !st0 || !state.unlocked.includes(eraId)) return state;
  const s = structuredClone(state);
  const rng = makeRng(s.rngSeed);
  era.impl.act(s.eras[eraId] as MechanicState, era.config, action, ctxFor(s, eras, era, () => rng.next()));
  s.rngSeed = rng.seed;
  checkProgress(s, eras);
  return s;
}

export function switchEra(state: GameState, eraId: string): GameState {
  return state.unlocked.includes(eraId) ? { ...state, currentEra: eraId } : state;
}
