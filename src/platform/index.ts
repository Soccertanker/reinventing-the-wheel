/**
 * The only module that talks to Capacitor. The game and UI call these functions;
 * Capacitor plugins provide the Android/iOS implementation and a web fallback,
 * so there is no per-platform code in the app itself.
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import type { KeyValueStore, LegacyStore } from './kv';

/** 'android' | 'ios' | 'web' */
export const platformName = Capacitor.getPlatform();
export const isNative = Capacitor.isNativePlatform();

/** Durable storage: SharedPreferences (Android), UserDefaults (iOS), localStorage (web). */
export const store: KeyValueStore = {
  get: async (key) => (await Preferences.get({ key })).value,
  set: (key, value) => Preferences.set({ key, value }),
  remove: (key) => Preferences.remove({ key }),
};

/** Where saves lived before this layer existed. Read once, for migration. */
export const legacyStore: LegacyStore | null = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

/** Light tap feedback. Fire-and-forget; silently does nothing where unsupported (e.g. desktop). */
export function hapticTap(): void {
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}
