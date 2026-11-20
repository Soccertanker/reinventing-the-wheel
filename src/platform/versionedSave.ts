/**
 * Generic versioned save for any game: each game has its own key, schema version and migrations.
 * Same guarantees as the main save: migrations run in order, saves from newer builds or corrupt
 * saves are backed up (never discarded), and a missing save starts a fresh game.
 */
import type { KeyValueStore } from './kv';

export type Migration = (s: Record<string, unknown>) => Record<string, unknown>;

export interface SaveSpec<T> {
  key: string;
  version: number;
  /** keyed by the OLD version; returns the next version's shape */
  migrations: Record<number, Migration>;
  fresh: () => T;
}

export class SaveFormatError extends Error {}

export function migrateSave<T>(raw: unknown, spec: SaveSpec<T>): T {
  if (typeof raw !== 'object' || raw === null) throw new SaveFormatError('save is not an object');
  let s = raw as Record<string, unknown>;
  if (typeof s.schemaVersion !== 'number') throw new SaveFormatError('save has no schemaVersion');
  if (s.schemaVersion > spec.version) throw new SaveFormatError(`save is from a newer version (${s.schemaVersion})`);
  while ((s.schemaVersion as number) < spec.version) {
    const step = spec.migrations[s.schemaVersion as number];
    if (!step) throw new SaveFormatError(`no migration from schema ${String(s.schemaVersion)}`);
    s = step(s);
  }
  return s as T;
}

export async function loadVersioned<T>(store: KeyValueStore, spec: SaveSpec<T>, now: number): Promise<T> {
  const raw = await store.get(spec.key);
  if (raw === null) return spec.fresh();
  try {
    return migrateSave(JSON.parse(raw), spec);
  } catch (err) {
    console.error('Could not load save; backing it up', err);
    await store.set(`${spec.key}.backup.${now}`, raw);
    return spec.fresh();
  }
}

export async function saveVersioned<T>(store: KeyValueStore, spec: SaveSpec<T>, state: T): Promise<void> {
  await store.set(spec.key, JSON.stringify(state));
}
