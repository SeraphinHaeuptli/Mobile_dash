import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistence port. The app depends on this interface, never on AsyncStorage
 * directly, so storage can be swapped or faked in tests.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const asyncStorageAdapter: KeyValueStore = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};

/**
 * A typed JSON slot on top of a KeyValueStore.
 *
 * `decode` is responsible for turning arbitrary stored JSON into a valid value:
 * persisted data outlives the schema that wrote it, so a slot from an older
 * build must degrade to defaults rather than crash the app on launch.
 */
export function jsonSlot<T>(
  store: KeyValueStore,
  key: string,
  decode: (raw: unknown) => T,
) {
  return {
    async load(): Promise<T> {
      try {
        const raw = await store.get(key);
        return decode(raw === null ? undefined : JSON.parse(raw));
      } catch {
        return decode(undefined);
      }
    },
    async save(value: T): Promise<void> {
      try {
        await store.set(key, JSON.stringify(value));
      } catch {
        // Persistence is best-effort; a failed write must not break the UI.
      }
    },
    async clear(): Promise<void> {
      try {
        await store.remove(key);
      } catch {
        // Same rationale as save().
      }
    },
  };
}
