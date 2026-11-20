import { CURRENT_SCHEMA_VERSION, type GameState } from './state';

/**
 * Save migrations. To change the save format:
 *  1. bump CURRENT_SCHEMA_VERSION in state.ts and update GameState
 *  2. add an entry here keyed by the OLD version that returns the next version's shape
 *  3. add a fixture test in save.test.ts using a real old save
 * Never delete a migration: a player may update from any old version.
 */
type AnySave = { schemaVersion: number } & Record<string, unknown>;
export const migrations: Record<number, (s: AnySave) => AnySave> = {
  // v1 (single Stone Age) -> v2 (multiple eras, each with its own mechanic state)
  1: (s) => ({
    schemaVersion: 2,
    lastTickAt: s.lastTickAt,
    pendingMs: 0,
    rngSeed: 0x5eed,
    currentEra: 'stone',
    unlocked: ['stone'],
    completed: [],
    eras: { stone: { wheels: s.wheels, made: s.totalWheels, owned: s.owned } },
    log: [],
    logSeq: 0,
  }),
};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export class SaveError extends Error {}

export function migrate(raw: unknown): GameState {
  if (typeof raw !== 'object' || raw === null) throw new SaveError('save is not an object');
  let s = raw as AnySave;
  if (typeof s.schemaVersion !== 'number') throw new SaveError('save has no schemaVersion');
  if (s.schemaVersion > CURRENT_SCHEMA_VERSION) {
    // Save from a newer build (e.g. rolled-back release). Refuse rather than corrupt it.
    throw new SaveError(`save is from a newer version (${s.schemaVersion})`);
  }
  while (s.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const step = migrations[s.schemaVersion];
    if (!step) throw new SaveError(`no migration from schema ${s.schemaVersion}`);
    s = step(s);
  }
  return s as unknown as GameState;
}

export function deserialize(json: string): GameState {
  return migrate(JSON.parse(json));
}
