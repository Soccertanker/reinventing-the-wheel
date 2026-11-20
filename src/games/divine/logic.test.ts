import { describe, expect, it } from 'vitest';
import { advance, consultOracle, content, dream, findInvention, maxFaith, newSave, won, type DivineSave } from './logic';

const rich = (s: DivineSave): DivineSave => ({ ...s, faith: 1000 });

describe('divine', () => {
  it('every invention is reachable from the starting symbols', () => {
    let s = rich(newSave(0));
    for (let round = 0; round < 10; round++) {
      for (const inv of content.inventions) if (s.symbols.includes(inv.a) && s.symbols.includes(inv.b)) s = rich(dream(s, inv.a, inv.b));
    }
    expect(s.discovered.sort()).toEqual(content.inventions.map((i) => i.id).sort());
  });

  it('the main path leads to the wheel and unlocks symbols along the way', () => {
    let s = rich(newSave(0));
    for (const [a, b] of [['tree', 'water'], ['moon', 'rock'], ['log', 'foot'], ['log', 'fire'], ['disk', 'stick'], ['axle', 'roll']] as const) {
      s = rich(dream(s, a, b));
    }
    expect(won(s)).toBe(true);
    expect(s.symbols).toContain('wheel');
    expect(s.last?.text).toContain(content.ending);
  });

  it('unknown dreams are duds; repeats give nothing new; faith is spent', () => {
    let s = newSave(0);
    const f = s.faith;
    s = dream(s, 'sun', 'snake');
    expect(findInvention('sun', 'snake')).toBeUndefined();
    expect(s.last?.kind).toBe('dud');
    expect(s.faith).toBe(f - content.dreamCost);
    s = rich(dream(rich(s), 'fire', 'water'));
    const followers = s.followers;
    s = dream(s, 'water', 'fire');
    expect(s.last?.kind).toBe('repeat');
    expect(s.followers).toBe(followers);
  });

  it('cannot dream without faith or with locked symbols', () => {
    const s = { ...newSave(0), faith: 0 };
    expect(dream(s, 'sun', 'moon')).toBe(s);
    expect(dream(rich(newSave(0)), 'wheel', 'sun').dreams).toBe(0);
  });

  it('faith regenerates over time up to a cap; the oracle gives the next hint', () => {
    let s = { ...newSave(0), faith: 0 };
    s = advance(s, 10_000);
    expect(s.faith).toBeGreaterThan(0);
    s = advance(s, 10_000_000);
    expect(s.faith).toBe(maxFaith(s));
    s = consultOracle(s);
    expect(s.last?.kind).toBe('oracle');
    expect(s.last?.text).toContain('floats');
  });
});
