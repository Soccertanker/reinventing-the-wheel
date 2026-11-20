import { describe, expect, it } from 'vitest';
import { content, evaluate, intelligentDesign, meteor, newSave, setTerrain, speciesName, step, togglePointy, type EvoSave } from './evolution';

const run = (s: EvoSave, n: number) => {
  for (let i = 0; i < n; i++) s = step(s);
  return s;
};

describe('evolution', () => {
  it('is deterministic for a seed', () => {
    expect(run(newSave(7), 5)).toEqual(run(newSave(7), 5));
  });

  it('natural selection makes shapes roll farther and rounder over generations', () => {
    const s = run(newSave(42), 120);
    const early = s.history.slice(0, 5).reduce((t, h) => t + h.best, 0) / 5;
    const late = s.history.slice(-5).reduce((t, h) => t + h.best, 0) / 5;
    expect(late).toBeGreaterThan(early);
    expect(s.history.at(-1)?.round ?? 0).toBeGreaterThan(s.history[0]?.round ?? 1);
    expect(s.milestones).toContain('move');
    console.log(`after 120 gens: best ${late.toFixed(1)}m, round ${(s.history.at(-1)?.round ?? 0).toFixed(3)}, milestones ${s.milestones.join(',')}`);
  });

  it('intelligent design inserts a circle that finishes', () => {
    const s = intelligentDesign(newSave(1));
    expect(s.cheated).toBe(true);
    const circle = evaluate(s.population.at(-1) as number[], s);
    expect(circle.result.finished).toBe(true);
    expect(speciesName(s.population.at(-1) as number[])).toMatch(/^Rotundus perfectus/);
  });

  it('meteors, terrain and pointy-love change the world', () => {
    let s = run(newSave(3), 10);
    const before = s.population;
    s = meteor(s);
    expect(s.population).not.toEqual(before);
    s = setTerrain(s, 'cliff');
    expect(s.terrain).toBe('cliff');
    s = togglePointy(s);
    expect(s.pointyLove).toBe(true);
    expect(s.population.length).toBe(content.population);
  });
});
