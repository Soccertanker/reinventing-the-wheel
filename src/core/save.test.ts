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
    // Literal v2 save (multi-era, before New Game+), as written by builds of that schema.
    2: {
      schemaVersion: 2,
      lastTickAt: 1000,
      pendingMs: 120,
      rngSeed: 99,
      currentEra: 'industrial',
      unlocked: ['stone', 'industrial'],
      completed: ['stone'],
      eras: {
        stone: { wheels: 50, made: 2100, owned: { chisel: 4 } },
        industrial: { wheels: 3, made: 12, pressure: 40, machines: { smelt: 2 }, stock: { iron: 4 }, stokers: 1, valve: true, explosions: 0, shovels: 9 },
      },
      log: [{ seq: 1, era: 'stone', msg: 'hi' }],
      logSeq: 1,
    },
    3: JSON.parse(serialize(newGame(eras, 1000, 3))),
  };

  it.each(Object.entries(fixtures))('migrates schema v%s to current and the game runs', (_v, save) => {
    const s = hydrate(migrate(structuredClone(save)), eras);
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(() => advance(s, eras, 60_000)).not.toThrow();
  });

  it('has a fixture for every schema version', () => {
    for (let v = 1; v <= CURRENT_SCHEMA_VERSION; v++) expect(fixtures[v]).toBeDefined();
  });

  it('v2 -> v3 keeps progress and starts with no reinventions', () => {
    const s = hydrate(migrate(structuredClone(fixtures[2])), eras);
    expect(s.reinventions).toBe(0);
    expect(s.pastWheels).toBe(0);
    expect(s.completed).toEqual(['stone']);
    expect(s.eras.industrial).toMatchObject({ made: 12, stokers: 1 });
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
