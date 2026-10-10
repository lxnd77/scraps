/**
 * The shape of the app's IndexedDB database. It lives apart from `idb.ts` so the service worker,
 * which opens the same database to park a shared payload, creates stores from the same list.
 *
 *   v1  outbox, blobs, meta, queryCache
 *   v2  shares: payloads that arrived through the share target, waiting for the capture sheet
 */
export const DB_NAME = "scraps-offline";
export const DB_VERSION = 2;

export type StoreName = "outbox" | "blobs" | "meta" | "queryCache" | "shares";

/** Creates any store that is missing; safe to run on every upgrade. */
export function upgradeSchema(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains("outbox")) {
    db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
  }
  for (const name of ["blobs", "meta", "queryCache", "shares"] as const) {
    if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
  }
}
