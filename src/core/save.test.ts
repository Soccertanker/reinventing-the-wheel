import { describe, expect, it } from 'vitest';
import { deserialize, migrate, SaveError, serialize } from './save';
import { CURRENT_SCHEMA_VERSION, newGame } from './state';

describe('save', () => {
  it('round-trips', () => {
    const s = { ...newGame(123), wheels: 42, owned: { chisel: 3 } };
    expect(deserialize(serialize(s))).toEqual(s);
  });

  // Fixtures: one real save per historical schema version. Add one each time the schema bumps.
  const fixtures: Record<number, unknown> = {
    1: { schemaVersion: 1, wheels: 5, totalWheels: 9, owned: { chisel: 1 }, lastTickAt: 1000 },
  };

  it.each(Object.entries(fixtures))('migrates schema v%s to current', (_v, save) => {
    const s = migrate(structuredClone(save));
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(s.totalWheels).toBeGreaterThanOrEqual(0);
  });

  it('has a fixture for every schema version', () => {
    for (let v = 1; v <= CURRENT_SCHEMA_VERSION; v++) expect(fixtures[v]).toBeDefined();
  });

  it('refuses saves from a newer version instead of wiping them', () => {
    expect(() => migrate({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(SaveError);
  });

  it('rejects garbage', () => {
    expect(() => migrate(null)).toThrow(SaveError);
    expect(() => migrate({})).toThrow(SaveError);
  });
});
