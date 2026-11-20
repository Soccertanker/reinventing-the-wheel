import { deserialize, serialize } from '../core/save';
import { newGame, type GameState } from '../core/state';

const KEY = 'rtw.save';

export function load(now: number): GameState {
  const raw = localStorage.getItem(KEY);
  if (!raw) return newGame(now);
  try {
    return deserialize(raw);
  } catch (err) {
    // Never silently discard progress: stash the unreadable save before starting fresh.
    console.error('Could not load save; backing it up', err);
    localStorage.setItem(`${KEY}.backup.${now}`, raw);
    return newGame(now);
  }
}

export function save(state: GameState): void {
  localStorage.setItem(KEY, serialize(state));
}
