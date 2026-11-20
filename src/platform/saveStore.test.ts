import { describe, expect, it } from 'vitest';
import { serialize } from '../core/save';
import { CURRENT_SCHEMA_VERSION, newGame } from '../core/state';
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

const saved = { ...newGame(0), wheels: 77 };

describe('saveStore', () => {
  it('starts a new game when nothing is stored', async () => {
    expect((await loadGame(memStore(), memLegacy(), 5)).lastTickAt).toBe(5);
  });

  it('round-trips through the durable store', async () => {
    const store = memStore();
    await saveGame(store, saved);
    expect(await loadGame(store, null, 0)).toEqual(saved);
  });

  it('moves a legacy localStorage save into the durable store once', async () => {
    const store = memStore();
    const legacy = memLegacy({ [SAVE_KEY]: serialize(saved) });
    expect((await loadGame(store, legacy, 0)).wheels).toBe(77);
    expect(store.data[SAVE_KEY]).toBeDefined();
    expect(legacy.data[SAVE_KEY]).toBeUndefined();
  });

  it('prefers the durable store over a stale legacy save', async () => {
    const store = memStore({ [SAVE_KEY]: serialize(saved) });
    const legacy = memLegacy({ [SAVE_KEY]: serialize({ ...saved, wheels: 1 }) });
    expect((await loadGame(store, legacy, 0)).wheels).toBe(77);
  });

  it('backs up an unreadable save instead of wiping it', async () => {
    const future = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
    const store = memStore({ [SAVE_KEY]: future });
    const state = await loadGame(store, null, 42);
    expect(state.wheels).toBe(0);
    expect(store.data[`${SAVE_KEY}.backup.42`]).toBe(future);
  });
});
