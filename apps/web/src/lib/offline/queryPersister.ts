import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { offlineDb, type OfflineDb } from "./idb";

/**
 * Bumped when the shape of cached query data changes. A client persisted under another version is
 * discarded on restore instead of being fed to code that no longer understands it.
 */
export const QUERY_CACHE_VERSION = "1";
export const QUERY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Query keys worth keeping on the device: lists, counts and people; never search results. */
const PERSISTED_ROOTS = new Set(["board", "kinds", "members", "streak"]);

export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === "string" && PERSISTED_ROOTS.has(queryKey[0]);
}

const KEY = "client";

/** Writes are coalesced: a burst of cache changes costs one IndexedDB write. */
export function createIdbPersister(db: OfflineDb = offlineDb, throttleMs = 1000): Persister {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: PersistedClient | null = null;

  const flush = async () => {
    timer = null;
    const client = latest;
    latest = null;
    if (client && db.available) {
      try {
        await db.put("queryCache", client, KEY);
      } catch {
        // storage full or blocked: the app works, it just restores from the network next time
      }
    }
  };

  return {
    persistClient: (client) => {
      latest = client;
      if (timer === null) timer = setTimeout(() => void flush(), throttleMs);
    },
    restoreClient: async () => {
      if (!db.available) return undefined;
      try {
        return await db.get<PersistedClient>("queryCache", KEY);
      } catch {
        return undefined;
      }
    },
    removeClient: async () => {
      if (db.available) await db.delete("queryCache", KEY).catch(() => {});
    },
  };
}
