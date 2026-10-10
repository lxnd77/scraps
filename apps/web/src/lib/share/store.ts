/**
 * Shared payloads wait in the `shares` object store of the offline database between the service
 * worker's POST handler and the capture sheet. The worker cannot use the app's OfflineDb class
 * (it pulls in app modules), so this file talks to IndexedDB directly and is used by both sides.
 */
import { DB_NAME, DB_VERSION, upgradeSchema } from "@/lib/offline/dbConfig";
import type { StoredShare } from "./payload";

const STORE = "shares";
/** A parked share that nobody opened is dropped after a day. */
export const SHARE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => upgradeSchema(req.result);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

async function run<T>(
  factory: IDBFactory,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open(factory);
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
    });
  } finally {
    db.close();
  }
}

const globalFactory = (): IDBFactory => globalThis.indexedDB;

export async function putShare(share: StoredShare, factory = globalFactory()): Promise<void> {
  await run(factory, "readwrite", (s) => s.put(share, share.id));
}

export async function getShare(
  id: string,
  factory = globalFactory(),
): Promise<StoredShare | undefined> {
  const found = await run<StoredShare | undefined>(factory, "readonly", (s) => s.get(id));
  if (!found) return undefined;
  return Date.now() - found.createdAt > SHARE_MAX_AGE_MS ? undefined : found;
}

export async function deleteShare(id: string, factory = globalFactory()): Promise<void> {
  await run(factory, "readwrite", (s) => s.delete(id));
}

/** Removes parked shares older than the cap. Called whenever a new one arrives. */
export async function pruneShares(factory = globalFactory()): Promise<void> {
  const all = await run<StoredShare[]>(factory, "readonly", (s) => s.getAll());
  const stale = all.filter((s) => Date.now() - s.createdAt > SHARE_MAX_AGE_MS);
  for (const s of stale) await deleteShare(s.id, factory);
}
