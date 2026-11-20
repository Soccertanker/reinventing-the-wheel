import { describe, expect, it } from 'vitest';
import { advance, hydrate, newGame } from './engine';
import { eras } from './eras';
import { deserialize, migrate, SaveError, serialize } from './save';
import { CURRENT_SCHEMA_VERSION } from './state';

describe('save', () => {
  it('round-trips', () => {
    const s = advance(newGame(eras, 0, 7), eras, 5000);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  // Fixtures: one real save per historical schema version. Add one each time the schema bumps.
  const fixtures: Record<number, unknown> = {
    1: { schemaVersion: 1, wheels: 5, totalWheels: 9, owned: { chisel: 1 }, lastTickAt: 1000 },
    2: JSON.parse(serialize(newGame(eras, 1000, 3))),
  };

  it.each(Object.entries(fixtures))('migrates schema v%s to current and the game runs', (_v, save) => {
    const s = hydrate(migrate(structuredClone(save)), eras);
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(() => advance(s, eras, 60_000)).not.toThrow();
  });

  it('has a fixture for every schema version', () => {
    for (let v = 1; v <= CURRENT_SCHEMA_VERSION; v++) expect(fixtures[v]).toBeDefined();
  });

  it('v1 -> v2 keeps the Stone Age progress', () => {
    const s = hydrate(migrate(structuredClone(fixtures[1])), eras);
    expect(s.eras.stone).toMatchObject({ wheels: 5, made: 9, owned: { chisel: 1 } });
    expect(s.currentEra).toBe('stone');
  });

  it('refuses saves from a newer version instead of wiping them', () => {
    expect(() => migrate({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(SaveError);
  });

  it('rejects garbage', () => {
    expect(() => migrate(null)).toThrow(SaveError);
    expect(() => migrate({})).toThrow(SaveError);
  });
});
