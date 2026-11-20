import { describe, expect, it } from 'vitest';
import { validateEra } from './content';
import { eras } from './eras';

describe('content', () => {
  it('all bundled eras are valid', () => {
    expect(eras.length).toBeGreaterThan(0);
    for (const e of eras) expect(() => validateEra(e)).not.toThrow();
  });

  it('rejects duplicate producer ids', () => {
    const p = { id: 'a', name: 'A', description: '', baseCost: 1, costGrowth: 1.1, wheelsPerSecond: 1 };
    expect(() =>
      validateEra({ id: 'x', name: 'X', clickYield: 1, producers: [p, p] }),
    ).toThrow(/duplicate/);
  });

  it('rejects bad numbers', () => {
    expect(() => validateEra({ id: 'x', name: 'X', clickYield: 0, producers: [] })).toThrow();
  });
});
