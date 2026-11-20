import { describe, expect, it } from 'vitest';
import { act, advance, advanceBy, bonusFor, eraTitle, goalFor, hydrate, lifetimeWheels, MAX_OFFLINE_MS, newGame, reinvent, TICK_MS } from './engine';
import { meta } from './meta';
import stoneJson from '../../content/eras/stone.json';
import { eras, loadEras } from './eras';
import type { GameState } from './state';

const era = (id: string) => {
  const e = eras.find((x) => x.id === id);
  if (!e) throw new Error(id);
  return e;
};

/** A game with every era unlocked and some production everywhere. */
function busyGame(): GameState {
  let s = newGame(eras, 0, 42);
  for (const e of eras.slice(0, -1)) {
    (s.eras[e.id] as { made: number }).made = e.goal.made;
    s = advanceBy(s, eras, TICK_MS); // unlocks the next era
  }
  (s.eras.stone as unknown as { owned: Record<string, number> }).owned = { chisel: 5, apprentice: 3 };
  s = act(s, eras, 'industrial', { type: 'shovel' });
  s = act(s, eras, 'lab', { type: 'run' });
  s = act(s, eras, 'supercomputer', { type: 'train' });
  s = act(s, eras, 'cosmic', { type: 'pi', value: 3.1416 });
  s = act(s, eras, 'cosmic', { type: 'gravity', value: 0 });
  s = act(s, eras, 'cosmic', { type: 'bang' });
  return s;
}

describe('content', () => {
  it('all bundled eras load and validate', () => {
    expect(eras.map((e) => e.id)).toEqual(['stone', 'industrial', 'lab', 'supercomputer', 'cosmic']);
  });

  it('rejects unknown mechanics and duplicate ids', () => {
    const def = stoneJson as Record<string, unknown>;
    expect(() => loadEras({ a: { ...def, mechanic: 'nope' } })).toThrow(/unknown mechanic/);
    expect(() => loadEras({ a: def, b: { ...def, order: 2 } })).toThrow(/duplicate era id/);
  });
});

describe('engine', () => {
  it('starts in the first era', () => {
    const s = newGame(eras, 0, 1);
    expect(s.unlocked).toEqual(['stone']);
    expect(s.log.length).toBe(1);
  });

  it('is deterministic regardless of how time is split (incl. random events)', () => {
    const start = busyGame();
    const oneShot = advanceBy(start, eras, 600_000);
    let stepped = start;
    for (let i = 0; i < 600; i++) stepped = advanceBy(stepped, eras, 1000);
    expect(stepped).toEqual(oneShot);
  });

  it('caps offline time and ignores clocks going backwards', () => {
    const s = newGame(eras, 0, 1);
    expect(advance(s, eras, MAX_OFFLINE_MS * 10).pendingMs).toBeLessThan(TICK_MS);
    expect(advance({ ...s, lastTickAt: 5000 }, eras, 1000).eras.stone).toEqual(s.eras.stone);
  });

  it('unlocks the next era when a goal is met, and applies the bonus', () => {
    let s = newGame(eras, 0, 1);
    (s.eras.stone as { made: number }).made = era('stone').goal.made;
    s = advanceBy(s, eras, TICK_MS);
    expect(s.unlocked).toContain('industrial');
    expect(s.completed).toContain('stone');
    expect(bonusFor(s, eras, era('industrial'))).toBe(era('stone').bonus);
    expect(bonusFor(s, eras, era('stone'))).toBe(1);
  });

  it('ignores actions for locked eras', () => {
    const s = newGame(eras, 0, 1);
    expect(act(s, eras, 'cosmic', { type: 'bang' })).toBe(s);
  });

  it('hydrate fills new fields and drops unknown eras', () => {
    const s = newGame(eras, 0, 1);
    s.eras.gone = { wheels: 1, made: 1 };
    s.unlocked.push('gone');
    delete (s.eras.stone as Partial<{ owned: unknown }>).owned;
    const h = hydrate(s, eras);
    expect(h.eras.gone).toBeUndefined();
    expect(h.unlocked).toEqual(['stone']);
    expect(h.eras.stone).toHaveProperty('owned');
  });
});

describe('reinvention (New Game+)', () => {
  const finishAll = () => {
    let s = newGame(eras, 0, 9);
    for (const e of eras) {
      (s.eras[e.id] as { made: number }).made = goalFor(s, e);
      s = advanceBy(s, eras, TICK_MS);
    }
    return s;
  };

  it('is only possible once every era is complete', () => {
    const s = newGame(eras, 0, 1);
    expect(reinvent(s, eras)).toBe(s);
    expect(finishAll().completed.length).toBe(eras.length);
  });

  it('resets eras, keeps a permanent multiplier, grows goals, renames eras', () => {
    const s = reinvent(finishAll(), eras);
    const stone = era('stone');
    expect(s.reinventions).toBe(1);
    expect(s.unlocked).toEqual(['stone']);
    expect(s.completed).toEqual([]);
    expect(s.eras.stone?.made).toBe(0);
    expect(bonusFor(s, eras, stone)).toBe(meta.loopMultiplier);
    expect(goalFor(s, stone)).toBe(Math.ceil(stone.goal.made * meta.goalGrowth));
    expect(eraTitle(s, stone)).toBe(`${meta.prefixes[0]}${stone.name}`);
    expect(lifetimeWheels(s)).toBe(lifetimeWheels(finishAll()));
  });
});
