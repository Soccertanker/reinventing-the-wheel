import { deserialize, serialize } from '../core/save';
import { newGame, type GameState } from '../core/state';
import type { KeyValueStore, LegacyStore } from './kv';

export const SAVE_KEY = 'rtw.save';

/**
 * Loads the save. Order: durable store -> legacy localStorage (moved over once) -> new game.
 * An unreadable save (corrupt or from a newer build) is backed up, never discarded.
 */
export async function loadGame(store: KeyValueStore, legacy: LegacyStore | null, now: number): Promise<GameState> {
  let raw = await store.get(SAVE_KEY);
  if (raw === null && legacy) {
    const old = legacy.getItem(SAVE_KEY);
    if (old !== null) {
      await store.set(SAVE_KEY, old);
      legacy.removeItem(SAVE_KEY);
      raw = old;
    }
  }
  if (raw === null) return newGame(now);
  try {
    return deserialize(raw);
  } catch (err) {
    console.error('Could not load save; backing it up', err);
    await store.set(`${SAVE_KEY}.backup.${now}`, raw);
    return newGame(now);
  }
}

export async function saveGame(store: KeyValueStore, state: GameState): Promise<void> {
  await store.set(SAVE_KEY, serialize(state));
}
