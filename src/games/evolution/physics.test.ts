import { describe, expect, it } from 'vitest';
import { bodyFromGenome, convexHull, roundness, simulate, type SimParams } from './physics';

const params: SimParams = { slopeDeg: 6, gravity: 9.8, push: 2, maxSeconds: 15, finish: 30 };
const regular = (n: number) => Array.from({ length: 16 }, (_, i) => (i % (16 / n) === 0 ? 1 : 0.05));

describe('physics', () => {
  it('convex hull drops interior points', () => {
    expect(convexHull([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]]).length).toBe(4);
  });

  it('a 16-gon (near circle) is round; a square is not', () => {
    expect(roundness(bodyFromGenome(Array(16).fill(1)))).toBeGreaterThan(0.97);
    expect(roundness(bodyFromGenome(regular(4)))).toBeLessThan(0.75);
  });

  it('round things roll farther than square things', () => {
    const circle = simulate(bodyFromGenome(Array(16).fill(1)), params);
    const square = simulate(bodyFromGenome(regular(4)), params);
    const octagon = simulate(bodyFromGenome(regular(8)), params);
    expect(circle.finished).toBe(true);
    expect(square.distance).toBeLessThan(3);
    expect(octagon.distance).toBeGreaterThan(square.distance);
    expect(circle.distance).toBeGreaterThan(octagon.distance);
  });

  it('on a cliff even a square tumbles', () => {
    const square = simulate(bodyFromGenome(regular(4)), { ...params, slopeDeg: 50 });
    expect(square.distance).toBeGreaterThan(10);
  });

  it('is deterministic and records a replay', () => {
    const b = bodyFromGenome([1, 0.8, 0.9, 0.7, 1, 0.95, 0.6, 0.9, 1, 0.85, 0.9, 0.75, 1, 0.9, 0.8, 0.95]);
    const a = simulate(b, params, true);
    expect(simulate(b, params)).toEqual({ ...a, samples: [] });
    expect(a.samples.length).toBeGreaterThan(5);
  });
});
