import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from './kv';
import { loadVersioned, migrateSave, saveVersioned, SaveFormatError, type SaveSpec } from './versionedSave';

interface V2 {
  schemaVersion: 2;
  count: number;
  name: string;
}

const spec: SaveSpec<V2> = {
  key: 'test.save',
  version: 2,
  migrations: { 1: (s) => ({ ...s, schemaVersion: 2, name: 'migrated' }) },
  fresh: () => ({ schemaVersion: 2, count: 0, name: 'fresh' }),
};

function memStore(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    get: async (k) => data[k] ?? null,
    set: async (k, v) => void (data[k] = v),
    remove: async (k) => void delete data[k],
  };
}

describe('versionedSave', () => {
  it('starts fresh, round-trips, and migrates old versions', async () => {
    const store = memStore();
    expect((await loadVersioned(store, spec, 0)).name).toBe('fresh');
    await saveVersioned(store, spec, { schemaVersion: 2, count: 5, name: 'x' });
    expect((await loadVersioned(store, spec, 0)).count).toBe(5);
    expect(migrateSave({ schemaVersion: 1, count: 3 }, spec)).toEqual({ schemaVersion: 2, count: 3, name: 'migrated' });
  });

  it('backs up newer or corrupt saves instead of wiping them', async () => {
    const store = memStore({ 'test.save': '{"schemaVersion":9}' });
    expect((await loadVersioned(store, spec, 7)).name).toBe('fresh');
    expect(store.data['test.save.backup.7']).toBe('{"schemaVersion":9}');
    expect(() => migrateSave('nope', spec)).toThrow(SaveFormatError);
  });
});
