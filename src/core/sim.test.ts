import { describe, expect, it } from 'vitest';
import type { Era } from './content';
import { advance, buy, costOf, MAX_OFFLINE_MS, reinvent } from './sim';
import { newGame, type GameState } from './state';

const era: Era = {
  id: 'test',
  name: 'Test',
  clickYield: 1,
  producers: [
    { id: 'p', name: 'P', description: '', baseCost: 10, costGrowth: 2, wheelsPerSecond: 1 },
  ],
};

describe('sim', () => {
  it('reinvent adds clickYield', () => {
    expect(reinvent(newGame(0), era).wheels).toBe(1);
  });

  it('cost grows geometrically', () => {
    const p = era.producers[0]!;
    expect([0, 1, 2].map((n) => costOf(p, n))).toEqual([10, 20, 40]);
  });

  it('buy deducts cost and refuses when unaffordable', () => {
    const poor = newGame(0);
    expect(buy(poor, era, 'p')).toBe(poor);
    const rich = { ...poor, wheels: 15 };
    const after = buy(rich, era, 'p');
    expect(after.wheels).toBe(5);
    expect(after.owned.p).toBe(1);
  });

  it('advance produces wheels over time', () => {
    const s = { ...newGame(0), owned: { p: 3 } };
    expect(advance(s, era, 2000).wheels).toBe(6);
  });

  it('offline progress is deterministic regardless of tick granularity', () => {
    const s = { ...newGame(0), owned: { p: 2 } };
    const oneShot = advance(s, era, 60_000);
    let stepped: GameState = s;
    for (let t = 1000; t <= 60_000; t += 1000) stepped = advance(stepped, era, t);
    expect(stepped.wheels).toBeCloseTo(oneShot.wheels);
  });

  it('caps offline time and ignores clocks going backwards', () => {
    const s = { ...newGame(0), owned: { p: 1 } };
    expect(advance(s, era, MAX_OFFLINE_MS * 10).wheels).toBe(MAX_OFFLINE_MS / 1000);
    expect(advance({ ...s, lastTickAt: 5000 }, era, 1000).wheels).toBe(0);
  });
});
