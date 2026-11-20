/** Minimal async key-value store. Implemented by Capacitor Preferences (native + web) and by test fakes. */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Synchronous legacy store (window.localStorage), only read for one-time migration. */
export interface LegacyStore {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}
