import { describe, expect, it } from 'vitest';
import { newGame } from '../core/engine';
import { eras } from '../core/eras';
import { serialize } from '../core/save';
import { CURRENT_SCHEMA_VERSION, type GameState } from '../core/state';
import type { KeyValueStore, LegacyStore } from './kv';
import { loadGame, SAVE_KEY, saveGame } from './saveStore';

function memStore(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    get: async (k) => data[k] ?? null,
    set: async (k, v) => {
      data[k] = v;
    },
    remove: async (k) => {
      delete data[k];
    },
  };
}
function memLegacy(init: Record<string, string> = {}): LegacyStore & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, removeItem: (k) => void delete data[k] };
}

const fresh = () => newGame(eras, 5, 1);
const stoneWheels = (s: GameState) => s.eras.stone?.wheels;
const saved: GameState = (() => {
  const s = newGame(eras, 0, 1);
  (s.eras.stone as { wheels: number }).wheels = 77;
  return s;
})();
// A real v1 save, as written by builds before multi-era support.
const v1Save = (wheels: number) =>
  JSON.stringify({ schemaVersion: 1, wheels, totalWheels: wheels, owned: { chisel: 1 }, lastTickAt: 0 });

describe('saveStore', () => {
  it('starts a new game when nothing is stored', async () => {
    expect((await loadGame(memStore(), memLegacy(), 5, fresh)).lastTickAt).toBe(5);
  });

  it('round-trips through the durable store', async () => {
    const store = memStore();
    await saveGame(store, saved);
    expect(await loadGame(store, null, 0, fresh)).toEqual(saved);
  });

  it('moves a legacy localStorage save into the durable store once (and migrates it)', async () => {
    const store = memStore();
    const legacy = memLegacy({ [SAVE_KEY]: v1Save(1234) });
    expect(stoneWheels(await loadGame(store, legacy, 0, fresh))).toBe(1234);
    expect(store.data[SAVE_KEY]).toBeDefined();
    expect(legacy.data[SAVE_KEY]).toBeUndefined();
  });

  it('prefers the durable store over a stale legacy save', async () => {
    const store = memStore({ [SAVE_KEY]: serialize(saved) });
    const legacy = memLegacy({ [SAVE_KEY]: v1Save(1) });
    expect(stoneWheels(await loadGame(store, legacy, 0, fresh))).toBe(77);
  });

  it('backs up an unreadable save instead of wiping it', async () => {
    const future = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
    const store = memStore({ [SAVE_KEY]: future });
    const state = await loadGame(store, null, 42, fresh);
    expect(stoneWheels(state)).toBe(0);
    expect(store.data[`${SAVE_KEY}.backup.42`]).toBe(future);
  });
});
